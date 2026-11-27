const { invalidResponse } = require('./xml');

function normalizeMesh(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw invalidResponse(); }
  if (!value || !Array.isArray(value.nodes) || value.nodes.length > 2048) throw invalidResponse();
  const nodes = [];
  const links = new Map();
  const interfaces = new Map();
  const macCounts = new Map();
  for (const node of value.nodes) {
    for (const iface of Array.isArray(node?.node_interfaces) ? node.node_interfaces : []) {
      const mac = typeof iface.mac_address === 'string' ? iface.mac_address.toUpperCase() : '';
      if (typeof iface.uid !== 'string' || !/^(?:[\dA-F]{2}:){5}[\dA-F]{2}$/.test(mac) || mac === '00:00:00:00:00:00') continue;
      interfaces.set(iface.uid, mac);
      macCounts.set(mac, (macCounts.get(mac) ?? 0) + 1);
    }
  }
  for (const node of value.nodes) {
    if (!node || typeof node.uid !== 'string' || !Array.isArray(node.node_interfaces)) throw invalidResponse();
    nodes.push({
      id: node.uid.slice(0, 128),
      name: String(node.device_friendly_name || node.device_name || '').slice(0, 255) || null,
      model: typeof node.device_model === 'string' ? node.device_model.slice(0, 255) : null,
      role: ['master', 'slave'].includes(node.mesh_role) ? node.mesh_role : 'unknown',
      meshed: typeof node.is_meshed === 'boolean' ? node.is_meshed : null
    });
    for (const iface of node.node_interfaces) {
      if (!Array.isArray(iface.node_links)) continue;
      for (const link of iface.node_links) {
        if (!link || typeof link.uid !== 'string' || typeof link.node_1_uid !== 'string' || typeof link.node_2_uid !== 'string') continue;
        const first = interfaces.get(link.node_interface_1_uid);
        const second = interfaces.get(link.node_interface_2_uid);
        const stableId = first && second && first !== second && macCounts.get(first) === 1 && macCounts.get(second) === 1
          ? `mac:${[first, second].sort().join('|')}|${link.type}` : null;
        links.set(link.uid, {
          id: link.uid.slice(0, 128), from: link.node_1_uid.slice(0, 128), to: link.node_2_uid.slice(0, 128),
          type: ['LAN', 'WLAN', 'PLC', 'DECT'].includes(link.type) ? link.type : 'unknown',
          state: ['CONNECTED', 'DISCONNECTED'].includes(link.state) ? link.state : 'unknown',
          rxSignalDbm: Number.isInteger(link.rx_rcpi) && link.rx_rcpi !== 255 ? link.rx_rcpi : null,
          stableId
        });
      }
    }
  }
  return { nodes, links: [...links.values()] };
}

module.exports = { normalizeMesh };
