const { isIP } = require('node:net');
const { child, field, invalidResponse, parseXml } = require('./xml');
const { createTransport, failure } = require('./transport');
const { normalizeMesh } = require('./mesh');

const SERVICE_PREFIX = 'urn:dslforum-org:service:';
const SOAP_NAMESPACE = 'http://schemas.xmlsoap.org/soap/envelope/';
const HOST_LIST = 'X_AVM-DE_GetHostListPath';
const MESH_LIST = 'X_AVM-DE_GetMeshListPath';
const MAX_INDEXED_HOSTS = 256;

function requiredNode(node, name) {
  if (node?.name !== name) throw invalidResponse();
  return node;
}

function findService(device, type) {
  const services = child(device, 'serviceList')?.children ?? [];
  const service = services.find((entry) => entry.name === 'service' && field(entry, 'serviceType') === type);
  if (service) return service;
  for (const embedded of child(device, 'deviceList')?.children ?? []) {
    if (embedded.name !== 'device') continue;
    const match = findService(embedded, type);
    if (match) return match;
  }
  return null;
}

function normalizeHosts(entries, prefix = '') {
  const hosts = new Map();
  let partial = false;
  for (const entry of entries) {
    const hostname = (field(entry, `${prefix}HostName`) || field(entry, 'X_AVM-DE_FriendlyName')).slice(0, 255) || null;
    const ip = field(entry, `${prefix}IPAddress`);
    const mac = field(entry, `${prefix}MACAddress`);
    const address = isIP(ip) && ip !== '0.0.0.0' && ip !== '::' ? ip.toLowerCase() : null;
    const macAddress = /^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(mac) && mac !== '00:00:00:00:00:00' ? mac.toUpperCase() : null;
    const active = field(entry, `${prefix}Active`).toLowerCase();
    const reportedActive = ['1', 'true'].includes(active) ? true : ['0', 'false'].includes(active) ? false : null;

    if ((ip && !isIP(ip)) || (mac && !macAddress && mac !== '00:00:00:00:00:00') || (active && reportedActive === null)) {
      partial = true;
    }
    if (!hostname && !address && !macAddress) {
      partial = true;
      continue;
    }

    // Merge only entries with the same observed MAC. Preserve source rows without a MAC.
    const key = macAddress ?? Symbol();
    const existing = hosts.get(key);
    if (!existing) {
      hosts.set(key, { hostname, addresses: address ? [address] : [], macAddress, reportedActive });
      continue;
    }
    if (address && !existing.addresses.includes(address)) existing.addresses.push(address);
    existing.hostname ??= hostname;
    if (reportedActive === true || existing.reportedActive === null) existing.reportedActive = reportedActive;
  }
  if (entries.length && !hosts.size) throw invalidResponse();
  return { hosts: [...hosts.values()], partial };
}

function createFritzAdapter(config) {
  const request = createTransport(config);
  const get = async (path, signal) => parseXml(await request(path, { signal }));

  async function describe(device, serviceName, signal) {
    const type = `${SERVICE_PREFIX}${serviceName}:1`;
    const service = findService(device, type);
    if (!service) return null;
    const scpdPath = field(service, 'SCPDURL');
    const controlPath = field(service, 'controlURL');
    if (!scpdPath || !controlPath) throw invalidResponse();
    const scpd = requiredNode(await get(scpdPath, signal), 'scpd');
    const actions = child(scpd, 'actionList')?.children ?? [];
    return { type, controlPath, actions: new Set(actions.filter((entry) => entry.name === 'action').map((entry) => field(entry, 'name'))) };
  }

  async function soap(service, action, signal, index) {
    if (!service?.actions.has(action)) throw failure('UNSUPPORTED');
    const args = index === undefined ? '' : `<NewIndex>${index}</NewIndex>`;
    const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="${SOAP_NAMESPACE}"><s:Body><u:${action} xmlns:u="${service.type}">${args}</u:${action}></s:Body></s:Envelope>`;
    const result = parseXml(await request(service.controlPath, { action: `${service.type}#${action}`, body, signal }));
    const response = requiredNode(child(requiredNode(result, 'Envelope'), 'Body'), 'Body');
    const node = requiredNode(child(response, `${action}Response`), `${action}Response`);
    if (result.namespace !== SOAP_NAMESPACE || response.namespace !== SOAP_NAMESPACE || node.namespace !== service.type) throw invalidResponse();
    return node;
  }

  async function readHosts(service, signal) {
    if (service.actions.has(HOST_LIST)) {
      const path = field(await soap(service, HOST_LIST, signal), 'NewX_AVM-DE_HostListPath');
      if (!path) throw invalidResponse();
      const list = requiredNode(await get(path, signal), 'List');
      if (list.text.trim() || list.children.some((entry) => entry.name !== 'Item')) throw invalidResponse();
      return normalizeHosts(list.children);
    }

    if (!service.actions.has('GetGenericHostEntry')) throw failure('UNSUPPORTED');
    const countValue = field(await soap(service, 'GetHostNumberOfEntries', signal), 'NewHostNumberOfEntries');
    const count = Number(countValue);
    if (!/^\d{1,5}$/.test(countValue) || count > 65535) throw invalidResponse();
    const entries = [];
    for (let index = 0; index < Math.min(count, MAX_INDEXED_HOSTS); index += 1) {
      try {
        entries.push(await soap(service, 'GetGenericHostEntry', signal, index));
      } catch (error) {
        if (!entries.length || error.code === 'AUTH_FAILED' || signal.aborted) throw error;
        return { ...normalizeHosts(entries, 'New'), partial: true };
      }
    }
    const result = normalizeHosts(entries, 'New');
    return { ...result, partial: result.partial || entries.length < count };
  }

  return {
    async collect({ signal }) {
      const descriptor = requiredNode(await get('/tr64desc.xml', signal), 'root');
      const device = requiredNode(child(descriptor, 'device'), 'device');
      const hostsService = await describe(device, 'Hosts', signal);
      if (!hostsService) throw failure('UNSUPPORTED');
      const infoService = await describe(device, 'DeviceInfo', signal);
      const router = {
        name: field(device, 'friendlyName').slice(0, 255) || null,
        model: field(device, 'modelName').slice(0, 255) || null,
        softwareVersion: null
      };
      let partial = false;
      if (infoService?.actions.has('GetInfo')) {
        try {
          const info = await soap(infoService, 'GetInfo', signal);
          router.model = router.model ?? (field(info, 'NewModelName').slice(0, 255) || null);
          router.softwareVersion = field(info, 'NewSoftwareVersion').slice(0, 64) || null;
        } catch (error) {
          if (signal.aborted || error.code === 'AUTH_FAILED') throw error;
          partial = true;
        }
      }
      if (!router.name && !router.model) throw invalidResponse();
      const observations = await readHosts(hostsService, signal);
      let mesh = null;
      let meshError = null;
      if (hostsService.actions.has(MESH_LIST)) {
        try {
          const path = field(await soap(hostsService, MESH_LIST, signal), 'NewX_AVM-DE_MeshListPath');
          if (!path) throw invalidResponse();
          mesh = normalizeMesh(await request(path, { signal }));
        } catch (error) {
          if (signal.aborted) throw error;
          meshError = ['AUTH_FAILED', 'TIMEOUT', 'INVALID_RESPONSE', 'CONNECTION_FAILED', 'ROUTER_ERROR'].includes(error.code) ? error.code : 'INVALID_RESPONSE';
        }
      }
      return {
        router,
        hosts: observations.hosts,
        mesh, meshError,
        partial: partial || observations.partial,
        capabilities: {
          hostList: hostsService.actions.has(HOST_LIST),
          indexedHosts: hostsService.actions.has('GetHostNumberOfEntries') && hostsService.actions.has('GetGenericHostEntry'),
          meshList: hostsService.actions.has(MESH_LIST)
        }
      };
    }
  };
}

module.exports = { createFritzAdapter };
