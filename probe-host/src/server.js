/**
 * IP Watch Probe Host
 * Author: Frank Ortner <f.ortner@iseo.de>
 * Author: Stefan Behnert <s.behnert@iseo.de>
 */
const express = require('express');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const CONFIG = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3001),
  pingTimeoutSec: Number(process.env.PING_TIMEOUT_SEC ?? 1),
  httpTimeoutMs: Number(process.env.HTTP_TIMEOUT_MS ?? 1500),
  enableHttpByDefault: String(process.env.ENABLE_HTTP_BY_DEFAULT ?? 'false') === 'true',
  apiToken: String(process.env.PROBE_API_TOKEN ?? '').trim()
};

const APP_VERSION = '0.2.0';
const VALID_TYPES = new Set(['PS5', 'PC', 'TV']);
const VALID_PROTOCOLS = new Set(['http', 'https']);

/**
 * Validates IPv4 string.
 * @param {string} value
 * @returns {boolean}
 */
function isIpv4(value) {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

/**
 * Normalizes IPv4 by removing leading zeros.
 * @param {string} value
 * @returns {string}
 */
function normalizeIpv4(value) {
  if (!isIpv4(value)) {
    return value;
  }
  return value
    .split('.')
    .map((part) => String(Number(part)))
    .join('.');
}

/**
 * Executes ICMP ping for one IP.
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function pingIp(ip) {
  try {
    await execFileAsync('ping', ['-c', '1', '-W', String(CONFIG.pingTimeoutSec), ip], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Executes HTTP/HTTPS probe for one device.
 * @param {object} device
 * @returns {Promise<boolean|null>}
 */
async function httpProbe(device) {
  const protocol = device.probeProtocol ?? (CONFIG.enableHttpByDefault ? 'http' : null);
  if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
    return null;
  }

  const port = device.probePort ? String(device.probePort) : protocol === 'https' ? '443' : '80';
  const endpoint = `${protocol}://${device.ip}:${port}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.httpTimeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal
    });
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves status source label from ping/http results.
 * @param {boolean} pingReachable
 * @param {boolean|null} httpReachable
 * @returns {'PING'|'HTTP'|'PING+HTTP'|'UNKNOWN'}
 */
function statusSource(pingReachable, httpReachable) {
  if (pingReachable && httpReachable === true) {
    return 'PING+HTTP';
  }
  if (pingReachable) {
    return 'PING';
  }
  if (httpReachable === true) {
    return 'HTTP';
  }
  return 'UNKNOWN';
}

/**
 * Validates one incoming device payload.
 * @param {object} input
 * @returns {{ok: boolean, error?: string, value?: object}}
 */
function validateAndNormalizeDevice(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid device payload.' };
  }

  const name = String(input.name ?? '').trim();
  const type = String(input.type ?? '').trim();
  const ip = normalizeIpv4(String(input.ip ?? '').trim());
  const probeProtocol = input.probeProtocol == null ? null : String(input.probeProtocol).trim().toLowerCase();
  const probePort = input.probePort == null || input.probePort === '' ? null : Number(input.probePort);

  if (name.length < 2 || name.length > 40) {
    return { ok: false, error: 'Name must be between 2 and 40 characters.' };
  }
  if (!VALID_TYPES.has(type)) {
    return { ok: false, error: 'Device type must be PS5, PC or TV.' };
  }
  if (!isIpv4(ip)) {
    return { ok: false, error: 'IP must be valid IPv4.' };
  }
  if (probeProtocol !== null && !VALID_PROTOCOLS.has(probeProtocol)) {
    return { ok: false, error: 'probeProtocol must be http or https.' };
  }
  if (probePort !== null && (!Number.isInteger(probePort) || probePort < 1 || probePort > 65535)) {
    return { ok: false, error: 'probePort must be between 1 and 65535.' };
  }

  return {
    ok: true,
    value: {
      name,
      type,
      ip,
      probeProtocol,
      probePort
    }
  };
}

/**
 * Probes one device.
 * @param {object} device
 * @returns {Promise<object>}
 */
async function probeDevice(device) {
  const pingReachable = await pingIp(device.ip);
  const httpReachable = await httpProbe(device);
  const source = statusSource(pingReachable, httpReachable);
  const isReachable = source !== 'UNKNOWN';

  return {
    ip: device.ip,
    isReachable,
    statusSource: source,
    pingReachable,
    httpReachable,
    lastCheckedAt: new Date().toISOString(),
    checkError: null
  };
}

/**
 * Starts server.
 * @returns {Promise<void>}
 */
async function main() {
  const app = express();
  const statusCache = new Map();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }
    return next();
  });
  app.use((req, res, next) => {
    if (!CONFIG.apiToken || req.path === '/api/health') {
      return next();
    }
    const auth = String(req.headers.authorization ?? '');
    const expected = `Bearer ${CONFIG.apiToken}`;
    if (auth !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  });
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ip-watch-probe-host',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      authEnabled: Boolean(CONFIG.apiToken),
      mode: 'stateless-probe'
    });
  });

  app.get('/api/status', (_req, res) => {
    return res.json({ items: Array.from(statusCache.values()) });
  });

  app.post('/api/status/check-now', async (req, res) => {
    const payload = req.body ?? {};
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.devices)) {
      return res.status(400).json({ error: 'Payload must include a devices array.' });
    }

    const normalizedDevices = [];
    const knownIps = new Set();
    for (let i = 0; i < payload.devices.length; i += 1) {
      const parsed = validateAndNormalizeDevice(payload.devices[i]);
      if (!parsed.ok) {
        return res.status(400).json({ error: `devices[${i}]: ${parsed.error}` });
      }
      if (knownIps.has(parsed.value.ip)) {
        return res.status(409).json({ error: `Duplicate IP in payload: ${parsed.value.ip}` });
      }
      knownIps.add(parsed.value.ip);
      normalizedDevices.push(parsed.value);
    }

    const items = [];
    for (const device of normalizedDevices) {
      items.push(await probeDevice(device));
    }

    statusCache.clear();
    items.forEach((item) => statusCache.set(item.ip, item));
    return res.json({ items });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`[probe-host] listening on ${CONFIG.host}:${CONFIG.port}`);
    console.log('[probe-host] mode: stateless probe API (device data remains in frontend)');
  });
}

main().catch((error) => {
  console.error('[probe-host] startup failed:', error);
  process.exit(1);
});
