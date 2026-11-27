const https = require('node:https');
const { createHash, randomBytes } = require('node:crypto');
const { invalidResponse } = require('./xml');

const MAX_RESPONSE_BYTES = 1024 * 1024;

function failure(code) {
  return Object.assign(new Error('FRITZ! request failed.'), { code });
}

function digestHeader(challenge, method, uri, username, password, body) {
  if (!/^Digest\s/i.test(challenge ?? '')) throw failure('AUTH_FAILED');
  const parameters = new Map();
  const pattern = /\s*([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]+))\s*(?:,|$)/gy;
  pattern.lastIndex = 'Digest'.length;
  while (pattern.lastIndex < challenge.length) {
    const match = pattern.exec(challenge);
    if (!match) throw failure('AUTH_FAILED');
    parameters.set(match[1].toLowerCase(), match[2]?.replace(/\\(.)/g, '$1') ?? match[3]);
  }
  const realm = parameters.get('realm');
  const nonce = parameters.get('nonce');
  const algorithm = parameters.get('algorithm') ?? 'MD5';
  const hashName = { MD5: 'md5', 'SHA-256': 'sha256' }[algorithm.toUpperCase().replace(/-SESS$/, '')];
  const options = parameters.get('qop')?.toLowerCase().split(',').map((entry) => entry.trim());
  const qop = options?.includes('auth') ? 'auth' : options?.find((entry) => entry === 'auth-int');
  if (realm === undefined || !nonce || !hashName || (options && !qop) || parameters.get('userhash') === 'true') {
    throw failure('AUTH_FAILED');
  }
  const hash = (value) => createHash(hashName).update(value).digest('hex');
  const cnonce = randomBytes(16).toString('hex');
  const nc = '00000001';
  let identity = hash(`${username}:${realm}:${password}`);
  const session = /-sess$/i.test(algorithm);
  if (session) identity = hash(`${identity}:${nonce}:${cnonce}`);
  const request = hash(`${method}:${uri}${qop === 'auth-int' ? `:${hash(body ?? '')}` : ''}`);
  const response = hash([identity, nonce, ...(qop ? [nc, cnonce, qop] : []), request].join(':'));
  const quoted = (value) => `"${value.replace(/["\\]/g, '\\$&')}"`;
  const parts = [
    `username=${quoted(username)}`, `realm=${quoted(realm)}`, `nonce=${quoted(nonce)}`,
    `uri=${quoted(uri)}`, `algorithm=${algorithm}`, `response=${quoted(response)}`
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`);
  if (qop || session) parts.push(`cnonce=${quoted(cnonce)}`);
  if (parameters.has('opaque')) parts.push(`opaque=${quoted(parameters.get('opaque'))}`);
  return `Digest ${parts.join(', ')}`;
}

function read(url, options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      response.on('error', reject);
      if (response.statusCode !== 200) {
        resolve({ status: response.statusCode, challenge: response.headers['www-authenticate'] });
        response.destroy();
        return;
      }

      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) request.destroy(invalidResponse());
        else chunks.push(chunk);
      });
      response.on('end', () => {
        try {
          const xml = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
          resolve({ status: 200, xml });
        } catch {
          reject(invalidResponse());
        }
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

function createTransport({ origin, username, password, ca, timeoutMs }) {
  return async (path, { action, body, signal }) => {
    let url;
    try {
      url = new URL(path, origin);
    } catch {
      throw invalidResponse();
    }
    if (url.origin !== origin || url.username || url.password || url.hash) throw invalidResponse();

    const deadline = AbortSignal.timeout(timeoutMs);
    const method = action ? 'POST' : 'GET';
    const headers = action ? {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      SOAPAction: `"${action}"`
    } : {};
    const options = { method, headers, signal: AbortSignal.any([deadline, signal]), ca, rejectUnauthorized: true };

    try {
      let result = await read(url, options, body);
      if (result.status === 401) {
        headers.Authorization = digestHeader(result.challenge, method, url.pathname + url.search, username, password, body);
        result = await read(url, options, body);
      }
      if ([401, 403].includes(result.status)) throw failure('AUTH_FAILED');
      if (result.status >= 300 && result.status < 400) throw invalidResponse();
      if (result.status !== 200) throw failure('ROUTER_ERROR');
      return result.xml;
    } catch (error) {
      if (deadline.aborted || signal.aborted) throw failure('TIMEOUT');
      if (['AUTH_FAILED', 'INVALID_RESPONSE', 'ROUTER_ERROR'].includes(error.code)) throw error;
      throw failure('CONNECTION_FAILED');
    }
  };
}

module.exports = { createTransport, failure };
