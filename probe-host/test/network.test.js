const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { after, before, test } = require('node:test');
const { setTimeout: sleep } = require('node:timers/promises');
const { createFritzAdapter } = require('../src/integrations/fritz/adapter');
const { createFritzCollector } = require('../src/integrations/fritz/collector');

const fixture = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const TOKEN = 'fixture-ip-watch-token';
const PASSWORD = 'fixture-router-password';
const QUERY = '/hosts.xml?sid=fixture-router-session';
const BULK = 'X_AVM-DE_GetHostListPath';
let directory;
let tls;

before(() => {
  directory = mkdtempSync(join(tmpdir(), 'ip-watch-router-test-'));
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  execFileSync(process.env.OPENSSL_BIN || 'openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=loopback-fixture',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert
  ], { stdio: 'ignore' });
  tls = { key: readFileSync(key), cert: readFileSync(cert), caFile: cert };
});

after(() => {
  // This directory was allocated exclusively for the ephemeral test certificate.
  if (directory) {
    for (const filename of ['key.pem', 'cert.pem']) rmSync(join(directory, filename), { force: true });
    require('node:fs').rmdirSync(directory);
  }
});

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

function soap(service, action, value) {
  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action}Response xmlns:u="urn:dslforum-org:service:${service}:1">${value}</u:${action}Response></s:Body></s:Envelope>`;
}

function validDigest(req) {
  const values = Object.fromEntries([...String(req.headers.authorization).matchAll(/(\w+)=(?:"([^"\n]*)"|([^, ]+))/g)]
    .map((match) => [match[1], match[2] ?? match[3]]));
  const md5 = (text) => createHash('md5').update(text).digest('hex');
  const a1 = md5(`fixture:router, fixture:${PASSWORD}`);
  const a2 = md5(`${req.method}:${req.url}`);
  return values.username === 'fixture' && values.nonce === 'fixture-nonce' && values.uri === req.url && values.opaque === 'fixture-opaque' &&
    values.response === md5(`${a1}:fixture-nonce:${values.nc}:${values.cnonce}:auth:${a2}`);
}

async function routerFixture(t, scenario = {}) {
  const calls = [];
  const server = https.createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
    req.setEncoding('utf8');
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const action = req.headers.soapaction?.split('#')[1]?.replace('"', '');
      calls.push(action ?? req.url);
      if (req.url === '/tr64desc.xml') return res.end(fixture('tr64desc.xml'));
      if (req.url === '/deviceinfoSCPD.xml') return res.end('<scpd><actionList><action><name>GetInfo</name></action></actionList></scpd>');
      if (req.url === '/hostsSCPD.xml') return res.end(scenario.scpd ?? fixture('hostsSCPD.xml'));
      if ([BULK, undefined].includes(action) && !validDigest(req)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Digest realm="router, fixture", nonce="fixture-nonce", qop="auth,auth-int", opaque="fixture-opaque"' });
        return res.end();
      }
      if (action === 'GetInfo') return res.end(soap('DeviceInfo', action, '<NewSoftwareVersion>0.0-fictional</NewSoftwareVersion>'));
      if (action === BULK) return res.end(soap('Hosts', action, `<NewX_AVM-DE_HostListPath>${scenario.path ?? QUERY}</NewX_AVM-DE_HostListPath>`));
      if (action === 'X_AVM-DE_GetMeshListPath') return res.end(soap('Hosts', action, '<NewX_AVM-DE_MeshListPath>/mesh.json</NewX_AVM-DE_MeshListPath>'));
      if (req.url === '/mesh.json') return res.end(JSON.stringify({ nodes: [{ uid: 'router', device_name: 'Router', mesh_role: 'master', is_meshed: true, node_interfaces: [{ node_links: [{ uid: 'link', node_1_uid: 'router', node_2_uid: 'client', type: 'WLAN', state: 'CONNECTED' }] }] }] }));
      if (action === 'GetHostNumberOfEntries') return res.end(soap('Hosts', action, '<NewHostNumberOfEntries>2</NewHostNumberOfEntries>'));
      if (action === 'GetGenericHostEntry' && body.includes('<NewIndex>0</NewIndex>')) {
        return res.end(soap('Hosts', action, '<NewHostName>Indexed host</NewHostName>'));
      }
      if (req.url === QUERY) {
        if (scenario.timeout) return;
        if (scenario.redirect) {
          res.writeHead(302, { Location: scenario.redirect });
          return res.end();
        }
        return res.end(scenario.hosts ?? fixture('hosts.xml'));
      }
      res.writeHead(500);
      return res.end();
    });
  });
  const port = await listen(server);
  t.after(() => { server.close(); server.closeAllConnections(); });
  const config = { origin: `https://127.0.0.1:${port}`, ca: tls.cert, username: 'fixture', password: PASSWORD, timeoutMs: 2000 };
  const collect = (overrides) => createFritzAdapter({ ...config, ...overrides }).collect({ signal: AbortSignal.timeout(5000) });
  return { calls, config, collect };
}

test('discovers nested services and reads only allowed fields through TLS and Digest', async (t) => {
  const { collect, calls } = await routerFixture(t);
  const result = await collect();
  assert.equal(result.router.name, 'Fixture FRITZ!Box');
  assert.equal(result.router.softwareVersion, '0.0-fictional');
  assert.deepEqual(result.capabilities, { hostList: true, indexedHosts: true, meshList: true });
  assert.equal(result.partial, false);
  assert.equal(result.hosts.length, 3);
  assert.equal(result.mesh.nodes[0].name, 'Router');
  assert.equal(result.mesh.links[0].state, 'CONNECTED');
  assert.deepEqual(result.hosts[0], { hostname: 'Fixture & Laptop', addresses: ['192.0.2.10', '2001:db8::10'], macAddress: '02:00:00:00:00:01', reportedActive: true });
  assert.equal(result.hosts[1].reportedActive, false);
  assert.equal(result.hosts[2].reportedActive, null);
  assert.doesNotMatch(JSON.stringify(result), /fixture-mesh-login-value|fixture-router-session/);
  assert.deepEqual(calls, ['/tr64desc.xml', '/hostsSCPD.xml', '/deviceinfoSCPD.xml', 'GetInfo', BULK, BULK, QUERY, QUERY, 'X_AVM-DE_GetMeshListPath', '/mesh.json', '/mesh.json']);
});

test('rejects bad credentials and untrusted TLS', async (t) => {
  const { collect } = await routerFixture(t);
  await assert.rejects(collect({ password: 'incorrect' }), { code: 'AUTH_FAILED' });
  await assert.rejects(collect({ ca: undefined }), { code: 'CONNECTION_FAILED' });
});

test('bounds timeouts and rejects unexpected origins, redirects, malformed XML and oversized responses', async (t) => {
  const scenarios = [
    [{ timeout: true }, 'TIMEOUT', { timeoutMs: 300 }],
    [{ path: 'https://example.invalid/hosts.xml' }, 'INVALID_RESPONSE'],
    [{ redirect: 'https://example.invalid/hosts.xml' }, 'INVALID_RESPONSE'],
    [{ hosts: '<List><Item></List>' }, 'INVALID_RESPONSE'],
    [{ hosts: '<!DOCTYPE List><List/>' }, 'INVALID_RESPONSE'],
    [{ hosts: `<List>${' '.repeat(1024 * 1024)}</List>` }, 'INVALID_RESPONSE']
  ];
  for (const [scenario, code, overrides] of scenarios) {
    const { collect } = await routerFixture(t, scenario);
    await assert.rejects(collect(overrides), { code });
  }
});

test('distinguishes empty, partial, and unsupported observations and handles indexed fallback', async (t) => {
  const empty = await routerFixture(t, { hosts: '<List/>' });
  assert.deepEqual((await empty.collect()).hosts, []);
  const partial = await routerFixture(t, { hosts: '<List><Item><HostName>Usable</HostName><IPAddress>invalid</IPAddress></Item><Item/></List>' });
  const observation = await partial.collect();
  assert.equal(observation.partial, true);
  assert.deepEqual(observation.hosts[0].addresses, []);
  const unsupported = await routerFixture(t, { scpd: '<scpd/>' });
  await assert.rejects(unsupported.collect(), { code: 'UNSUPPORTED' });
  const indexed = await routerFixture(t, { scpd: '<scpd><actionList><action><name>GetHostNumberOfEntries</name></action><action><name>GetGenericHostEntry</name></action></actionList></scpd>' });
  const fallback = await indexed.collect();
  assert.equal(fallback.partial, true);
  assert.equal(fallback.hosts[0].hostname, 'Indexed host');
  assert.equal(fallback.capabilities.hostList, false);
});

async function startApp(t, env) {
  const reservation = http.createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  const server = spawn(process.execPath, [join(__dirname, '../src/server.js')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), PROBE_API_TOKEN: '', FRITZ_ENABLED: 'false', FRITZ_CA_FILE: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (chunk) => { output += chunk; });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exit = once(server, 'exit');
      server.kill();
      await exit;
    }
    assert.doesNotMatch(output, /fixture-router-password|fixture-router-session|fixture-mesh-login-value|fixture-ip-watch-token/);
  });
  const request = (path, options) => fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(2000), ...options });
  await waitFor(async () => (await request('/api/health').catch(() => null))?.ok);
  return request;
}

async function waitFor(check) {
  for (let tries = 0; tries < 100; tries += 1) {
    const result = await check();
    if (result) return result;
    await sleep(30);
  }
  assert.fail('Timed out waiting for local fixture.');
}

test('serves protected network contracts and preserves legacy API traffic', async (t) => {
  const { config } = await routerFixture(t);
  const request = await startApp(t, { FRITZ_ENABLED: 'true', FRITZ_URL: config.origin, FRITZ_USERNAME: 'fixture', FRITZ_PASSWORD: PASSWORD, FRITZ_CA_FILE: tls.caFile, PROBE_API_TOKEN: TOKEN });
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const unauthorized = await request('/api/v1/network/devices', { headers: { Origin: 'https://example.test' } });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('access-control-allow-origin'), null);
  assert.equal((await unauthorized.json()).error.code, 'UNAUTHORIZED');
  const snapshot = await waitFor(async () => {
    const response = await request('/api/v1/network/devices', { headers: auth });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { data } = await response.json();
    return data.state === 'ready' && data;
  });
  assert.equal(snapshot.hosts.length, 3);
  assert.doesNotMatch(JSON.stringify(snapshot), /fixture-mesh-login-value|fixture-router-session/);
  const { data } = await (await request('/api/v1/network/integrations', { headers: auth })).json();
  assert.equal(data.lastSuccessAt, snapshot.observedAt);
  assert.equal(data.capabilities.meshList, true);
  assert.equal((await request('/api/v1/network/devices', { method: 'OPTIONS' })).status, 405);
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/status')).status, 401);
  assert.deepEqual(await (await request('/api/status', { headers: auth })).json(), { items: [] });
  const headers = { ...auth, 'Content-Type': 'application/json' };
  const result = await request('/api/status/check-now', { method: 'POST', headers, body: '{"devices":[]}' });
  assert.deepEqual(await result.json(), { items: [] });
});

test('keeps the collector off by default and fails closed on invalid configuration', async (t) => {
  const request = await startApp(t, {});
  assert.equal((await (await request('/api/v1/network/devices')).json()).data.state, 'disabled');
  assert.equal((await request('/api/status')).status, 200);
  const { config, calls } = await routerFixture(t);
  const incomplete = await startApp(t, { FRITZ_ENABLED: 'true', FRITZ_URL: config.origin, FRITZ_USERNAME: 'fixture', FRITZ_PASSWORD: PASSWORD, FRITZ_CA_FILE: tls.caFile });
  assert.equal((await (await incomplete('/api/v1/network/devices')).json()).data.state, 'configuration_error');
  assert.equal(calls.length, 0);
  const invalid = createFritzCollector({ FRITZ_ENABLED: 'true', FRITZ_URL: 'http://127.0.0.1' }, TOKEN, () => assert.fail('Adapter created'));
  assert.equal(invalid.integration().errorCode, 'INVALID_CONFIGURATION');
});

test('keeps an old observation on failure, backs off, and recovers without overlapping polls', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let calls = 0;
  const observation = { router: {}, hosts: [], capabilities: {}, partial: false };
  const collector = createFritzCollector({ FRITZ_ENABLED: 'true', FRITZ_URL: 'https://127.0.0.1', FRITZ_USERNAME: 'fixture', FRITZ_PASSWORD: PASSWORD, FRITZ_POLL_INTERVAL_MS: '10000' }, TOKEN, () => ({
    async collect() {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error(PASSWORD), { code: 'AUTH_FAILED' });
      return observation;
    }
  }));
  t.after(() => collector.stop());
  collector.start();
  collector.start();
  await Promise.resolve();
  const previous = collector.devices().observedAt;
  t.mock.timers.tick(10000);
  await Promise.resolve();
  assert.equal(collector.devices().state, 'stale');
  assert.equal(collector.devices().observedAt, previous);
  assert.equal(collector.integration().errorCode, 'AUTH_FAILED');
  t.mock.timers.tick(19999);
  assert.equal(calls, 2);
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(calls, 3);
  assert.equal(collector.devices().state, 'ready');
  assert.notEqual(collector.devices().observedAt, previous);
  collector.stop();
  t.mock.timers.tick(10000);
  assert.equal(calls, 3);
});
