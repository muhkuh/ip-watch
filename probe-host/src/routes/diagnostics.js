const express = require('express');
const { apiContext, requireApiToken } = require('./versioned-api');
const { targets, routerAddress } = require('../diagnostics/path-targets');
const MAC = /^(?:[\da-f]{2}:){5}[\da-f]{2}$/i;

function createDiagnosticsRouter(store, fritz, token) {
  const router = express.Router();
  router.use(apiContext, requireApiToken(token));
  router.use((_req, res, next) => store ? next() : res.locals.fail(503, 'DIAGNOSTICS_UNAVAILABLE', 'Diagnostics storage is unavailable.'));
  const pathList = () => Object.entries(targets).map(([id, target]) => ({ id, name: target.name, address: id === 'router' ? routerAddress(process.env.FRITZ_URL) : target.address, enabled: store.pathTargets().includes(id) }));
  router.get('/path-targets', (_req, res) => res.json({ data: pathList() }));
  router.put('/path-targets/:id', (req, res) => {
    if (!Object.hasOwn(targets, req.params.id)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid path target.');
    store.setPathTarget(req.params.id, true);
    return res.json({ data: pathList() });
  });
  router.delete('/path-targets/:id', (req, res) => {
    if (!Object.hasOwn(targets, req.params.id)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid path target.');
    store.setPathTarget(req.params.id, false);
    return res.json({ data: pathList() });
  });
  router.get('/path-targets/:id/history', (req, res) => {
    if (!Object.hasOwn(targets, req.params.id)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid path target.');
    return res.json({ data: store.pathHistory(req.params.id) });
  });
  router.get('/targets', (_req, res) => res.json({ data: store.targets() }));
  router.put('/targets/:mac', (req, res) => {
    const mac = req.params.mac.toUpperCase();
    if (!MAC.test(mac)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid device identifier.');
    const discovery = fritz.devices();
    const matches = discovery.state === 'ready' ? discovery.hosts.filter((host) => host.macAddress === mac) : [];
    if (matches.length !== 1) return res.locals.fail(409, 'TARGET_UNAVAILABLE', 'Device is not uniquely present in the current router snapshot.');
    try { store.add(mac, (matches[0].hostname || mac).slice(0, 255)); }
    catch (error) { if (error.code === 'TARGET_LIMIT') return res.locals.fail(409, error.code, error.message); throw error; }
    return res.json({ data: store.targets() });
  });
  router.delete('/targets/:mac', (req, res) => {
    if (!MAC.test(req.params.mac)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid device identifier.');
    store.remove(req.params.mac.toUpperCase());
    return res.json({ data: store.targets() });
  });
  router.get('/targets/:mac/history', (req, res) => {
    const mac = req.params.mac.toUpperCase();
    if (!MAC.test(mac)) return res.locals.fail(422, 'INVALID_TARGET', 'Invalid device identifier.');
    return res.json({ data: store.history(mac) });
  });
  return router;
}

module.exports = { createDiagnosticsRouter };
