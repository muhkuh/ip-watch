const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { copyFileSync, mkdtempSync, readFileSync, rmSync, rmdirSync, statSync } = require('node:fs');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function candidate(release, database, check) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((done) => reservation.close(done));

  const token = randomBytes(24).toString('hex');
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: join(release, 'probe-host'), stdio: 'inherit',
    env: {
      ...process.env, HOST: '127.0.0.1', PORT: String(port), PROBE_API_TOKEN: token,
      FRITZ_ENABLED: 'false', INVENTORY_ENABLED: 'true', INVENTORY_DB_PATH: database,
      ENABLE_HTTP_BY_DEFAULT: 'false'
    }
  });
  const exited = once(child, 'exit');
  const base = `http://127.0.0.1:${port}`;
  const get = (path, options) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(2000), ...options });
  const request = (path, data) => get(path, {
    method: data === undefined ? 'GET' : 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });

  try {
    let health;
    for (let tries = 0; tries < 50 && child.exitCode === null; tries += 1) {
      health = await get('/api/health').catch(() => null);
      if (health?.ok) break;
      await delay(100);
    }
    assert.equal(health?.ok, true, 'Candidate health ready');
    assert.equal((await health.json()).service, 'ip-watch-probe-host');
    assert.deepEqual(await (await request('/api/status')).json(), { items: [] });
    assert.equal((await (await request('/api/v1/network/devices')).json()).data.state, 'disabled');
    const panel = '/api/v1/patch-panels/main';
    assert.equal((await get(`${panel}/ports`)).status, 401);
    await check(panel, request);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node pi-release-smoke.cjs /path/to/extracted-release');
  const release = resolve(process.argv[2]);
  assert.ok(statSync(join(release, 'web/index.html')).size > 0);
  assert.ok(Object.keys(JSON.parse(readFileSync(join(release, 'web/ngsw.json'), 'utf8')).hashTable).length > 0);

  const temp = mkdtempSync(join(tmpdir(), 'ip-watch-release-smoke-'));
  const original = join(temp, 'test.sqlite');
  const backup = join(temp, 'backup.sqlite');
  const restored = join(temp, 'restored.sqlite');
  try {
    await candidate(release, original, async (panel, request) => {
      const initial = (await (await request(`${panel}/ports`)).json()).data;
      assert.equal(initial.ports.length, 12);
      const response = await request(`${panel}/ports/12`, {
        revision: initial.revision,
        port: { label: 'Test outlet', room: 'Test room', outlet: 'A', notes: '', switchPort: 16, verified: true }
      });
      assert.equal(response.ok, true);
    });
    copyFileSync(original, backup);
    copyFileSync(backup, restored);
    await candidate(release, restored, async (panel, request) => {
      const saved = (await (await request(`${panel}/ports`)).json()).data;
      assert.equal(saved.ports[11].label, 'Test outlet');
      const { data: document } = await (await request(`${panel}/export`)).json();
      const result = await request(`${panel}/import`, { revision: saved.revision, document });
      assert.equal(result.ok, true);
      assert.equal((await result.json()).data.revision, saved.revision + 1);
    });
    console.log(`Release smoke passed on ${process.platform}/${process.arch} Node ${process.version}.`);
  } finally {
    for (const path of [original, backup, restored]) {
      rmSync(path, { force: true });
      rmSync(`${path}-journal`, { force: true });
    }
    rmSync(join(temp, 'diagnostics.sqlite'), { force: true });
    rmSync(join(temp, 'diagnostics.sqlite-journal'), { force: true });
    rmdirSync(temp);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
