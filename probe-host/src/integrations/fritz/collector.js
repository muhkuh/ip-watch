const { readFileSync } = require('node:fs');
const { X509Certificate } = require('node:crypto');
const { createFritzAdapter } = require('./adapter');

const MAX_POLL_MS = 45000;
const KNOWN_ERRORS = new Set(['AUTH_FAILED', 'TIMEOUT', 'INVALID_RESPONSE', 'CONNECTION_FAILED', 'ROUTER_ERROR', 'UNSUPPORTED']);

function readConfig(env, apiToken) {
  if (!apiToken) throw new Error('Missing IP Watch API token.');
  const url = new URL(env.FRITZ_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid FRITZ! origin.');
  }
  const username = env.FRITZ_USERNAME;
  const password = env.FRITZ_PASSWORD;
  const intervalMs = Number(env.FRITZ_POLL_INTERVAL_MS ?? 60000);
  const timeoutMs = Number(env.FRITZ_REQUEST_TIMEOUT_MS ?? 5000);
  if (!/^[\x20-\x7e]+$/.test(username ?? '') || username.includes(':') || !password ||
      !Number.isInteger(intervalMs) || intervalMs < 10000 || intervalMs > 3600000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 15000) {
    throw new Error('Invalid FRITZ! settings.');
  }
  const ca = env.FRITZ_CA_FILE ? readFileSync(env.FRITZ_CA_FILE) : undefined;
  if (ca) new X509Certificate(ca);
  return { origin: url.origin, username, password, ca, intervalMs, timeoutMs };
}

function createFritzCollector(env, apiToken, createAdapter = createFritzAdapter) {
  const enabled = String(env.FRITZ_ENABLED ?? '').trim().toLowerCase() === 'true';
  const status = {
    source: 'fritz-tr064', state: enabled ? 'pending' : 'disabled',
    lastAttemptAt: null, lastSuccessAt: null, capabilities: null, errorCode: null
  };
  let snapshot = null;
  let config;
  let adapter;
  let timer;
  let active;
  let stopped = false;
  let failures = 0;

  if (enabled) {
    try {
      config = readConfig(env, apiToken);
      adapter = createAdapter(config);
    } catch {
      status.state = 'configuration_error';
      status.errorCode = 'INVALID_CONFIGURATION';
    }
  }

  async function poll() {
    if (stopped) return;
    active = new AbortController();
    const deadline = AbortSignal.timeout(MAX_POLL_MS);
    status.lastAttemptAt = new Date().toISOString();
    try {
      const result = await adapter.collect({ signal: AbortSignal.any([active.signal, deadline]) });
      if (stopped) return;
      const observedAt = new Date().toISOString();
      snapshot = { router: result.router, hosts: result.hosts, mesh: result.mesh ?? null, meshError: result.meshError ?? null, observedAt, partial: result.partial };
      status.lastSuccessAt = observedAt;
      status.capabilities = result.capabilities;
      status.state = result.partial ? 'partial' : 'ready';
      status.errorCode = null;
      failures = 0;
    } catch (error) {
      if (stopped) return;
      status.state = 'unavailable';
      status.errorCode = deadline.aborted ? 'TIMEOUT' : KNOWN_ERRORS.has(error.code) ? error.code : 'CONNECTION_FAILED';
      failures = Math.min(failures + 1, 4);
    } finally {
      active = undefined;
      if (!stopped) timer = setTimeout(poll, Math.min(config.intervalMs * 2 ** failures, Math.max(config.intervalMs, 300000)));
    }
  }

  return {
    start() {
      if (adapter && !stopped && !active && timer === undefined) void poll();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      active?.abort();
    },
    integration() {
      return { ...status };
    },
    devices() {
      const state = snapshot && status.state === 'unavailable' ? 'stale' : status.state;
      return {
        source: status.source, state, observedAt: snapshot?.observedAt ?? null,
        router: snapshot?.router ?? null, hosts: snapshot?.hosts ?? null, partial: snapshot?.partial ?? false
      };
    },
    mesh() {
      return {
        source: status.source,
        state: snapshot && status.state === 'unavailable' ? 'stale' : status.state,
        observedAt: snapshot?.observedAt ?? null,
        topology: snapshot?.mesh ?? null,
        errorCode: snapshot?.meshError ?? null
      };
    }
  };
}

module.exports = { createFritzCollector };
