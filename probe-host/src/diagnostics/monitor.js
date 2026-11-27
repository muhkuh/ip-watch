const { targets, routerAddress } = require('./path-targets');

function createMonitor(store, fritz, ping, routerUrl) {
  let timer;
  let stopped = false;
  let running = false;
  async function poll() {
    if (stopped || running) return;
    running = true;
    try {
      const discovery = fritz.devices();
      const mesh = fritz.mesh();
      const values = [];
      for (const target of store.targets()) {
        if (stopped) return;
        const matches = discovery.state === 'ready' && Array.isArray(discovery.hosts) ? discovery.hosts.filter((host) => host.macAddress === target.mac) : [];
        const addresses = matches.length === 1 ? matches[0].addresses.filter((address) => !address.includes(':')) : [];
        const address = addresses.length === 1 ? addresses[0] : null;
        const result = address ? await ping(address) : { reachable: null, latencyMs: null };
        values.push({ mac: target.mac, address, responded: result.reachable, latencyMs: result.latencyMs });
      }
      const pathValues = [];
      for (const id of store.pathTargets?.() ?? []) {
        if (stopped) return;
        const address = id === 'router' ? routerAddress(routerUrl) : targets[id]?.address;
        const result = address ? await ping(address) : { reachable: null, latencyMs: null };
        pathValues.push({ id, time: new Date().toISOString(), address: address ?? null, responded: result.reachable, latencyMs: result.latencyMs });
      }
      if (!stopped) store.record(new Date().toISOString(), values, mesh.state === 'ready' && !mesh.errorCode ? mesh.topology : null, pathValues);
    } catch {
      console.error('[diagnostics] collection failed');
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(poll, 30000);
    }
  }
  return { start: () => { void poll(); }, stop: () => { stopped = true; clearTimeout(timer); }, isRunning: () => running };
}

module.exports = { createMonitor };
