const express = require('express');
const { apiContext, requireApiToken } = require('./versioned-api');

function createPatchPanelRouter({ store, errorCode }, apiToken) {
  const router = express.Router();
  router.use(apiContext);
  if (apiToken) router.use(requireApiToken(apiToken));
  router.use((_req, res, next) => {
    if (store) return next();
    return res.locals.fail(503, errorCode, 'Patch panel inventory is unavailable.');
  });

  const json = express.json({ limit: '64kb', inflate: false });
  const send = (operation) => (req, res) => res.json({ data: operation(req) });
  router.get('/main/ports', send(() => store.get()));
  router.put('/main/ports/:position', json, send((req) => {
    if (!/^(?:[1-9]|1[0-2])$/.test(req.params.position)) {
      throw Object.assign(new Error('Patch panel position not found.'), { status: 404, code: 'NOT_FOUND' });
    }
    return store.update(req.body?.revision, Number(req.params.position), req.body?.port);
  }));
  router.get('/main/export', send(() => {
    const { panelId, ports } = store.get();
    return { schemaVersion: 1, panelId, ports };
  }));
  router.put('/main/import', json, send((req) => store.import(req.body?.revision, req.body?.document)));
  router.use((_req, res) => res.locals.fail(404, 'NOT_FOUND', 'Patch panel endpoint not found.'));
  router.use((error, _req, res, _next) => {
    const fail = res.locals.fail;
    if (error.type === 'entity.parse.failed') return fail(400, 'INVALID_JSON', 'Expected a valid JSON object.');
    if (error.type === 'entity.too.large') return fail(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
      return fail(415, 'UNSUPPORTED_ENCODING', 'Expected an uncompressed UTF-8 JSON body.');
    }
    if ([404, 409, 422].includes(error.status)) return fail(error.status, error.code, error.message);
    console.error(`[inventory] request failed (${res.get('X-Request-Id')})`);
    return fail(503, 'INVENTORY_UNAVAILABLE', 'Patch panel inventory is unavailable.');
  });
  return router;
}

module.exports = { createPatchPanelRouter };
