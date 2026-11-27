const { isAbsolute } = require('node:path');
const { closeSync, openSync } = require('node:fs');

const PANEL_ID = 'main';
const PORT_COUNT = 12;
const FIELDS = { label: 80, room: 80, outlet: 80, notes: 500 };

function inventoryError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function invalid() {
  return inventoryError(422, 'INVALID_INVENTORY', 'Invalid patch panel data.');
}

function normalizePort(input) {
  if (!input || typeof input !== 'object' || !Number.isInteger(input.position) ||
      input.position < 1 || input.position > PORT_COUNT || typeof input.verified !== 'boolean') {
    throw invalid();
  }
  const text = {};
  for (const [field, limit] of Object.entries(FIELDS)) {
    if (typeof input[field] !== 'string' || input[field].length > limit) throw invalid();
    text[field] = input[field].trim();
  }
  const { switchPort } = input;
  if (switchPort !== null && (!Number.isInteger(switchPort) || switchPort < 1 || switchPort > 16)) throw invalid();
  if (text.outlet && !text.room) throw invalid();
  if (input.verified && !(text.room && text.outlet)) throw invalid();
  return { position: input.position, ...text, switchPort, verified: input.verified };
}

function validateMappings(ports) {
  const switchPorts = new Set();
  const outlets = new Set();
  for (const port of ports) {
    if (port.switchPort !== null) {
      if (switchPorts.has(port.switchPort)) throw inventoryError(409, 'DUPLICATE_SWITCH_PORT', 'Switch port already assigned.');
      switchPorts.add(port.switchPort);
    }
    if (port.outlet) {
      const key = JSON.stringify([port.room, port.outlet].map((value) => value.normalize('NFC').toLowerCase()));
      if (outlets.has(key)) throw inventoryError(409, 'DUPLICATE_OUTLET', 'Room outlet already assigned.');
      outlets.add(key);
    }
  }
}

function openInventory(path) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!path || !isAbsolute(path) || major < 24 || (major === 24 && minor < 15)) {
    throw new Error('Inventory requires Node 24.15 or later and an absolute database path.');
  }
  const { DatabaseSync } = require('node:sqlite');
  try {
    closeSync(openSync(path, 'ax', 0o600));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const db = new DatabaseSync(path);

  try {
    db.exec('PRAGMA busy_timeout = 1500; BEGIN IMMEDIATE');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version === 0) {
      db.exec(`
        CREATE TABLE inventory (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL) STRICT;
        INSERT INTO inventory VALUES (1, 0);
        CREATE TABLE patch_port (
          position INTEGER PRIMARY KEY CHECK (position BETWEEN 1 AND 12),
          label TEXT NOT NULL DEFAULT '', room TEXT NOT NULL DEFAULT '', outlet TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '', switch_port INTEGER CHECK (switch_port BETWEEN 1 AND 16),
          verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1))
        ) STRICT;
        WITH RECURSIVE positions(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM positions WHERE n<12)
        INSERT INTO patch_port (position) SELECT n FROM positions;
        PRAGMA user_version = 1;
      `);
    } else if (version !== 1) {
      throw new Error('Unsupported inventory schema.');
    }
    db.exec('COMMIT');

    const readRevision = db.prepare('SELECT revision FROM inventory WHERE id = 1');
    const readPorts = db.prepare('SELECT position, label, room, outlet, notes, switch_port AS switchPort, verified FROM patch_port ORDER BY position');
    const writePort = db.prepare('UPDATE patch_port SET label = ?, room = ?, outlet = ?, notes = ?, switch_port = ?, verified = ? WHERE position = ?');
    const bumpRevision = db.prepare('UPDATE inventory SET revision = revision + 1 WHERE id = 1');

    const snapshot = () => ({
      panelId: PANEL_ID,
      revision: readRevision.get().revision,
      ports: readPorts.all().map((port) => ({ ...port, verified: Boolean(port.verified) }))
    });

    const transact = (mode, operation) => {
      db.exec(mode);
      try {
        const result = operation();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };

    const save = (revision, replacements) => transact('BEGIN IMMEDIATE', () => {
      const current = snapshot();
      if (!Number.isSafeInteger(revision) || revision < 0) throw invalid();
      if (revision !== current.revision) throw inventoryError(409, 'REVISION_CONFLICT', 'Reload the inventory before saving.');
      const ports = current.ports.map((port) => replacements.get(port.position) ?? port);
      validateMappings(ports);
      for (const port of replacements.values()) {
        writePort.run(port.label, port.room, port.outlet, port.notes, port.switchPort, Number(port.verified), port.position);
      }
      bumpRevision.run();
      return snapshot();
    });

    return {
      get: () => transact('BEGIN', snapshot),
      update(revision, position, input) {
        const port = normalizePort({ ...input, position });
        return save(revision, new Map([[position, port]]));
      },
      import(revision, document) {
        if (document?.schemaVersion !== 1 || document.panelId !== PANEL_ID ||
            !Array.isArray(document.ports) || document.ports.length !== PORT_COUNT) throw invalid();
        const ports = new Map(document.ports.map((entry) => {
          const port = normalizePort(entry);
          return [port.position, port];
        }));
        if (ports.size !== PORT_COUNT) throw invalid();
        return save(revision, ports);
      },
      close: () => db.close()
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

module.exports = { openInventory };
