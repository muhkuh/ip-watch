const express = require('express');
const { apiContext, requireApiToken } = require('./versioned-api');

function createNetworkRouter(collector, apiToken) {
  const router = express.Router();
  const authenticate = apiToken ? requireApiToken(apiToken) : (_req, _res, next) => next();
  const routes = new Map([
    ['/integrations', () => collector.integration()],
    ['/devices', () => collector.devices()],
    ['/mesh', () => collector.mesh()]
  ]);

  router.use(apiContext, (req, res) => {
    const { fail } = res.locals;
    const route = routes.get(req.path);
    if (!route) return fail(404, 'NOT_FOUND', 'Network endpoint not found.');
    if (req.method !== 'GET') {
      res.set('Allow', 'GET');
      return fail(405, 'METHOD_NOT_ALLOWED', 'Only GET is supported.');
    }
    return authenticate(req, res, () => res.json({ data: route() }));
  });

  return router;
}

module.exports = { createNetworkRouter };
