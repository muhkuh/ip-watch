const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');
const express = require('express');
const { openInventory } = require('../src/inventory/store');
const { createPatchPanelRouter } = require('../src/routes/patch-panels');

const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major > 24 || (major === 24 && minor >= 15);
const fixtureToken = 'fixture-patch-panel-token';
const fields = { label: 'Test panel', room: 'Office', outlet: 'A', notes: '', switchPort: 16, verified: true };

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'ip-watch-inventory-test-'));
  const path = join(directory, 'fixture.sqlite');
  let store;
  t.after(() => {
    store?.close();
    for (const filename of ['fixture.sqlite', 'fixture.sqlite-journal']) rmSync(join(directory, filename), { force: true });
    require('node:fs').rmdirSync(directory);
  });
  return {
    path,
    reopen() {
      store?.close();
      store = openInventory(path);
      return store;
    }
  };
}

test('starts with 12 empty positions and persists assignments across reopen', { skip: !supported }, (t) => {
  const db = fixture(t);
  const store = db.reopen();
  const initial = store.get();
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.ports.map((port) => port.position), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(initial.ports[0].switchPort, null);
  assert.equal(initial.ports[0].verified, false);
  const saved = store.update(0, 12, fields);
  assert.deepEqual(saved.ports[11], { position: 12, ...fields });
  assert.deepEqual(db.reopen().get(), saved);
});

test('rejects stale and duplicate edits across concurrent handles', { skip: !supported }, (t) => {
  const db = fixture(t);
  const writer = db.reopen();
  const peer = openInventory(db.path);
  try {
    writer.update(0, 1, fields);
    assert.throws(() => peer.update(0, 2, fields), { code: 'REVISION_CONFLICT' });
    assert.throws(() => peer.update(1, 2, { ...fields, outlet: 'B' }), { code: 'DUPLICATE_SWITCH_PORT' });
    assert.throws(() => peer.update(1, 2, { ...fields, room: 'office', outlet: 'a ', switchPort: 1 }), { code: 'DUPLICATE_OUTLET' });
    assert.throws(() => peer.update(1, 2, { ...fields, outlet: '' }), { code: 'INVALID_INVENTORY' });
    assert.equal(writer.get().revision, 1);
    assert.equal(writer.get().ports[1].label, '');
  } finally {
    peer.close();
  }
});

test('imports a full snapshot atomically and permits moving a mapping', { skip: !supported }, (t) => {
  const store = fixture(t).reopen();
  const { panelId, revision, ports } = store.update(0, 1, fields);
  const document = { schemaVersion: 1, panelId, ports: structuredClone(ports) };
  document.ports[1] = { position: 2, ...fields };
  assert.throws(() => store.import(revision, document), { code: 'DUPLICATE_SWITCH_PORT' });
  assert.deepEqual(store.get().ports, ports);
  document.ports[0] = { ...document.ports[0], room: '', outlet: '', verified: false, switchPort: null };
  assert.equal(store.import(revision, document).ports[1].switchPort, 16);
  assert.throws(() => store.import(revision + 1, { ...document, ports: document.ports.slice(1) }), { code: 'INVALID_INVENTORY' });
});

test('protects same-origin API operations and returns structured validation errors', { skip: !supported }, async (t) => {
  const store = fixture(t).reopen();
  const app = express();
  app.use(createPatchPanelRouter({ store }, fixtureToken));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = once(server, 'close');
    server.close();
    await closed;
  });
  const base = `http://127.0.0.1:${server.address().port}/main`;
  assert.equal((await fetch(`${base}/ports`)).status, 401);
  const headers = { Authorization: `Bearer ${fixtureToken}`, 'Content-Type': 'application/json' };
  const request = (path, body) => fetch(`${base}${path}`, body === undefined ? { headers } : { method: 'PUT', headers, body });
  assert.equal((await request('/ports/1', '{')).status, 400);
  assert.equal((await request('/ports/13', '{}')).status, 404);
  assert.equal((await request('/ports/1', JSON.stringify({ revision: 0, port: fields }))).status, 200);
  const response = await request('/export');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const { data: document } = await response.json();
  assert.equal(document.ports[0].label, fields.label);
  const imported = await request('/import', JSON.stringify({ revision: 1, document }));
  assert.equal((await imported.json()).data.revision, 2);
  const conflict = await request('/ports/12', JSON.stringify({ revision: 1, port: fields }));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, 'REVISION_CONFLICT');
});
