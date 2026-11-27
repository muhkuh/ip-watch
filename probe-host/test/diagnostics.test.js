const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, rmdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { test } = require('node:test');
const { openDiagnostics } = require('../src/diagnostics/store');
const { createMonitor } = require('../src/diagnostics/monitor');
const { createDiagnosticsRouter } = require('../src/routes/diagnostics');
const express = require('express');
const { once } = require('node:events');
const { normalizeMesh } = require('../src/integrations/fritz/mesh');

test('unstable FRITZ snapshot UIDs produce a stable interface-based comparison key', () => {
  const snapshot = (suffix) => JSON.stringify({ nodes: [
    { uid: `a${suffix}`, node_interfaces: [{ uid: `ia${suffix}`, mac_address: '02:00:00:00:00:01', node_links: [{ uid: `l${suffix}`, node_1_uid: `a${suffix}`, node_2_uid: `b${suffix}`, node_interface_1_uid: `ia${suffix}`, node_interface_2_uid: `ib${suffix}`, type: 'WLAN', state: 'CONNECTED' }] }] },
    { uid: `b${suffix}`, node_interfaces: [{ uid: `ib${suffix}`, mac_address: '02:00:00:00:00:02', node_links: [] }] }
  ] });
  assert.equal(normalizeMesh(snapshot('1')).links[0].stableId, normalizeMesh(snapshot('2')).links[0].stableId);
});

test('upgrades existing diagnostics data without presenting legacy UID-based events', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ip-watch-upgrade-'));
  const path = join(dir, 'diagnostics.sqlite');
  const { DatabaseSync } = require('node:sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE target (mac TEXT PRIMARY KEY, name TEXT NOT NULL) STRICT;
    CREATE TABLE sample (mac TEXT NOT NULL, time TEXT NOT NULL, address TEXT, responded INTEGER, latency_ms REAL) STRICT;
    CREATE TABLE mesh_event (time TEXT NOT NULL, link_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL, state TEXT NOT NULL) STRICT;
    CREATE TABLE mesh_state (link_id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL, state TEXT NOT NULL) STRICT;
    INSERT INTO target VALUES ('02:00:00:00:00:01', 'Fixture');
    INSERT INTO mesh_event VALUES ('9999-01-01T00:00:00.000Z', 'l1', 'n1', 'n2', 'WLAN', 'CONNECTED');
    INSERT INTO mesh_state VALUES ('l1', 'n1', 'n2', 'WLAN', 'CONNECTED');
    PRAGMA user_version=1;`);
  legacy.close();
  const store = openDiagnostics(join(dir, 'inventory.sqlite'));
  t.after(() => { store.close(); rmSync(path, { force: true }); rmdirSync(dir); });
  assert.equal(store.targets()[0].name, 'Fixture');
  assert.deepEqual(store.history('02:00:00:00:00:01').events, []);
  store.record(new Date().toISOString(), [], { links: [{ id: 'new', stableId: 'mac:02:00:00:00:00:01|02:00:00:00:00:02|WLAN', type: 'WLAN', state: 'CONNECTED' }] });
  assert.deepEqual(store.history('02:00:00:00:00:01').events, []);
});

test('mesh normalizer preserves only supported observations and excludes session data', () => {
  const result = normalizeMesh(JSON.stringify({ nodes: [{ uid: 'a', device_name: 'Fixture', mesh_role: 'master', is_meshed: true,
    url: 'fixture-secret', node_interfaces: [{ node_links: [{ uid: 'l', node_1_uid: 'a', node_2_uid: 'b', type: 'WLAN', state: 'CONNECTED', rx_rcpi: 255 }] }] }] }));
  assert.equal(result.links[0].rxSignalDbm, null);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
  assert.throws(() => normalizeMesh('{'), { code: 'INVALID_RESPONSE' });
});

test('diagnostics persists measurements and mesh changes without modifying the inventory', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ip-watch-diagnostics-'));
  let store = openDiagnostics(join(dir, 'inventory.sqlite'));
  t.after(() => { store.close(); rmSync(join(dir, 'diagnostics.sqlite'), { force: true }); rmSync(join(dir, 'diagnostics.sqlite-journal'), { force: true }); rmdirSync(dir); });
  const now = new Date().toISOString();
  const link = { id: 'link', from: 'a', to: 'b', stableId: 'mac:02:00:00:00:00:01|02:00:00:00:00:02|WLAN', type: 'WLAN', state: 'CONNECTED' };
  store.add('02:00:00:00:00:01', 'Fixture');
  store.record(now, [{ mac: '02:00:00:00:00:01', address: '192.0.2.1', responded: true, latencyMs: 3.5 }], { links: [link] });
  store.record(now, [], { links: [{ ...link, id: 'changed-uid', from: 'changed-a', to: 'changed-b' }] });
  assert.equal(store.history('02:00:00:00:00:01').events.length, 0);
  store.record(now, [{ mac: '02:00:00:00:00:01', address: null, responded: null, latencyMs: null }], { links: [{ ...link, state: 'DISCONNECTED' }] });
  store.close();
  store = openDiagnostics(join(dir, 'inventory.sqlite'));
  assert.equal(store.targets().length, 1);
  const history = store.history('02:00:00:00:00:01');
  assert.equal(history.samples.length, 2);
  assert.equal(history.events[0].state, 'DISCONNECTED');
  assert.ok(history.samples.some((sample) => sample.latencyMs === 3.5));
  assert.ok(history.samples.some((sample) => sample.responded === null));
});

test('monitor skips ambiguous addresses and records unavailable observations', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  let records;
  let calls = 0;
  const store = { targets: () => [{ mac: 'A' }], record: (_time, values) => { records = values; } };
  const fritz = { devices: () => ({ state: 'ready', hosts: [{ macAddress: 'A', addresses: ['192.0.2.1', '192.0.2.2'] }] }), mesh: () => ({ state: 'unavailable' }) };
  const monitor = createMonitor(store, fritz, async () => { calls += 1; });
  monitor.start();
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.equal(records[0].responded, null);
  monitor.stop();
});

test('path targets persist and record replies, unanswered probes and unavailable measurements', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ip-watch-path-'));
  let store = openDiagnostics(join(dir, 'inventory.sqlite'));
  t.after(() => { store.close(); rmSync(join(dir, 'diagnostics.sqlite'), { force: true }); rmdirSync(dir); });
  store.setPathTarget('router', true);
  store.setPathTarget('cloudflare', true);
  const now = new Date().toISOString();
  store.record(now, [], null, [
    { id: 'router', time: now, address: 'fritz.box', responded: true, latencyMs: 2 },
    { id: 'cloudflare', time: now, address: '1.1.1.1', responded: false, latencyMs: null },
    { id: 'cloudflare', time: now, address: null, responded: null, latencyMs: null }
  ]);
  store.close();
  store = openDiagnostics(join(dir, 'inventory.sqlite'));
  assert.deepEqual(store.pathTargets(), ['cloudflare', 'router']);
  assert.equal(store.pathHistory('router').samples[0].latencyMs, 2);
  assert.deepEqual(store.pathHistory('cloudflare').samples.map((item) => item.responded).sort(), [false, null]);
});

test('monitor probes only enabled fixed path targets and records their observations', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const calls = [];
  let recorded;
  const store = { targets: () => [], pathTargets: () => ['router', 'cloudflare'], record: (_time, _values, _topology, paths) => { recorded = paths; } };
  const fritz = { devices: () => ({ state: 'unavailable' }), mesh: () => ({ state: 'unavailable' }) };
  const monitor = createMonitor(store, fritz, async (address) => { calls.push(address); return { reachable: true, latencyMs: 4 }; }, 'https://fritz.box:49443');
  monitor.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['fritz.box', '1.1.1.1']);
  assert.equal(recorded[0].responded, true);
  assert.equal(recorded[1].latencyMs, 4);
  monitor.stop();
});

test('diagnostics API requires a token and only accepts currently discovered MAC addresses', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ip-watch-api-'));
  const store = openDiagnostics(join(dir, 'inventory.sqlite'));
  const fritz = { devices: () => ({ state: 'ready', hosts: [{ macAddress: '02:00:00:00:00:01', hostname: 'Fixture' }] }) };
  const app = express();
  app.use(createDiagnosticsRouter(store, fritz, 'fixture-token'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = once(server, 'close'); server.close(); await closed;
    store.close(); rmSync(join(dir, 'diagnostics.sqlite'), { force: true }); rmdirSync(dir);
  });
  const url = `http://127.0.0.1:${server.address().port}/targets`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { Authorization: 'Bearer fixture-token' };
  const paths = url.replace('/targets', '/path-targets');
  assert.equal((await fetch(`${paths}/127.0.0.1`, { method: 'PUT', headers })).status, 422);
  assert.equal((await fetch(`${paths}/cloudflare`, { method: 'PUT', headers })).status, 200);
  assert.equal((await fetch(`${paths}/cloudflare/history`, { headers })).status, 200);
  const absent = await fetch(`${url}/02:00:00:00:00:02`, { method: 'PUT', headers });
  assert.equal(absent.status, 409);
  const added = await fetch(`${url}/02:00:00:00:00:01`, { method: 'PUT', headers });
  assert.equal(added.status, 200);
  assert.equal(added.headers.get('cache-control'), 'no-store');
  assert.equal(added.headers.get('access-control-allow-origin'), null);
  assert.equal((await added.json()).data[0].name, 'Fixture');
  assert.equal((await fetch(`${url}/02:00:00:00:00:01/history`, { headers })).status, 200);
  assert.equal((await fetch(`${url}/02:00:00:00:00:01`, { method: 'DELETE', headers })).status, 200);
});
