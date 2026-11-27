const targets = Object.freeze({
  router: { name: 'FRITZ!Box', address: null },
  cloudflare: { name: 'Cloudflare', address: '1.1.1.1' },
  google: { name: 'Google', address: '8.8.8.8' }
});

function routerAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-z\d.-]+$/i.test(url.hostname) ? url.hostname : null;
  } catch { return null; }
}

module.exports = { targets, routerAddress };
