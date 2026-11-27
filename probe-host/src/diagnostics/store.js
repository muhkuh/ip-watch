const { dirname, join } = require('node:path');
const { openSync, closeSync } = require('node:fs');

function openDiagnostics(inventoryPath) {
  const path = join(dirname(inventoryPath), 'diagnostics.sqlite');
  try { closeSync(openSync(path, 'ax', 0o600)); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=1500; BEGIN IMMEDIATE');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 3) throw new Error('Unsupported diagnostics schema.');
    db.exec(`
      CREATE TABLE IF NOT EXISTS target (mac TEXT PRIMARY KEY, name TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS sample (mac TEXT NOT NULL, time TEXT NOT NULL, address TEXT, responded INTEGER, latency_ms REAL) STRICT;
      CREATE INDEX IF NOT EXISTS sample_time ON sample(time);
      CREATE INDEX IF NOT EXISTS sample_target ON sample(mac,time);
      CREATE TABLE IF NOT EXISTS mesh_event (time TEXT NOT NULL, link_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL, state TEXT NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS event_time ON mesh_event(time);
      CREATE TABLE IF NOT EXISTS mesh_state (link_id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL, state TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS path_target (id TEXT PRIMARY KEY) STRICT;
      CREATE TABLE IF NOT EXISTS path_sample (id TEXT NOT NULL, time TEXT NOT NULL, address TEXT, responded INTEGER, latency_ms REAL) STRICT;
      CREATE INDEX IF NOT EXISTS path_sample_target ON path_sample(id,time);
      `);
    if (version < 2) db.exec('ALTER TABLE mesh_event ADD COLUMN reliable INTEGER NOT NULL DEFAULT 0');
    db.exec('PRAGMA user_version=3; COMMIT');
    const list = db.prepare('SELECT mac, name FROM target ORDER BY name COLLATE NOCASE');
    const add = db.prepare('INSERT INTO target(mac,name) VALUES(?,?) ON CONFLICT(mac) DO UPDATE SET name=excluded.name');
    const remove = db.prepare('DELETE FROM target WHERE mac=?');
    const insert = db.prepare('INSERT INTO sample(mac,time,address,responded,latency_ms) VALUES(?,?,?,?,?)');
    const samples = db.prepare('SELECT time, address, responded, latency_ms AS latencyMs FROM sample WHERE mac=? AND time>=? ORDER BY time DESC LIMIT 2880');
    const events = db.prepare('SELECT time,link_id AS id,from_id AS "from",to_id AS "to",type,state FROM mesh_event WHERE time>=? AND reliable=1 ORDER BY time DESC LIMIT 500');
    const oldLinks = db.prepare("SELECT link_id AS id,from_id AS \"from\",to_id AS \"to\",type,state FROM mesh_state WHERE link_id LIKE 'mac:%'");
    const clearLinks = db.prepare('DELETE FROM mesh_state');
    const saveLink = db.prepare('INSERT INTO mesh_state VALUES(?,?,?,?,?)');
    const event = db.prepare('INSERT INTO mesh_event (time,link_id,from_id,to_id,type,state,reliable) VALUES(?,?,?,?,?,?,1)');
    const pruneSamples = db.prepare('DELETE FROM sample WHERE time<?');
    const pruneEvents = db.prepare('DELETE FROM mesh_event WHERE time<?');
    const listPath = db.prepare('SELECT id FROM path_target ORDER BY id');
    const addPath = db.prepare('INSERT OR IGNORE INTO path_target(id) VALUES(?)');
    const removePath = db.prepare('DELETE FROM path_target WHERE id=?');
    const insertPath = db.prepare('INSERT INTO path_sample(id,time,address,responded,latency_ms) VALUES(?,?,?,?,?)');
    const pathSamples = db.prepare('SELECT time,address,responded,latency_ms AS latencyMs FROM path_sample WHERE id=? AND time>=? ORDER BY time DESC LIMIT 2880');
    const prunePath = db.prepare('DELETE FROM path_sample WHERE time<?');
    const transaction = (fn) => {
      db.exec('BEGIN IMMEDIATE');
      try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; }
    };
    return {
      targets: () => list.all(),
      add(mac, name) { if (list.all().length >= 32 && !list.all().some((target) => target.mac === mac)) throw Object.assign(new Error('Target limit reached.'), { code: 'TARGET_LIMIT' }); add.run(mac, name); },
      remove: (mac) => remove.run(mac),
      pathTargets: () => listPath.all().map((row) => row.id),
      setPathTarget(id, enabled) { (enabled ? addPath : removePath).run(id); },
      record(time, values, topology, pathValues = []) {
        transaction(() => {
          for (const value of values) insert.run(value.mac, time, value.address, value.responded === null ? null : Number(value.responded), value.latencyMs);
          for (const value of pathValues) insertPath.run(value.id, value.time, value.address, value.responded === null ? null : Number(value.responded), value.latencyMs);
          if (topology) {
            const previous = new Map(oldLinks.all().map((link) => [link.id, link]));
            const counts = new Map();
            for (const link of topology.links) if (link.stableId) counts.set(link.stableId, (counts.get(link.stableId) ?? 0) + 1);
            const comparable = topology.links.filter((link) => link.stableId && counts.get(link.stableId) === 1);
            for (const link of comparable) {
              const old = previous.get(link.stableId);
              const [first, second] = link.stableId.slice(4).split('|');
              if (old && old.state !== link.state) event.run(time, link.stableId, first, second, link.type, link.state);
            }
            clearLinks.run();
            for (const link of comparable) {
              const [first, second] = link.stableId.slice(4).split('|');
              saveLink.run(link.stableId, first, second, link.type, link.state);
            }
          }
          const cutoff = new Date(Date.parse(time) - 24 * 60 * 60 * 1000).toISOString();
          pruneSamples.run(cutoff); pruneEvents.run(cutoff); prunePath.run(cutoff);
        });
      },
      history(mac) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return { samples: samples.all(mac, cutoff).map((row) => ({ ...row, responded: row.responded === null ? null : Boolean(row.responded) })), events: events.all(cutoff) };
      },
      pathHistory(id) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return { samples: pathSamples.all(id, cutoff).map((row) => ({ ...row, responded: row.responded === null ? null : Boolean(row.responded) })), events: events.all(cutoff) };
      },
      close: () => db.close()
    };
  } catch (error) { db.close(); throw error; }
}

module.exports = { openDiagnostics };
