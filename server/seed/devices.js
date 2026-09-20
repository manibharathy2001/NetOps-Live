/*
 * Lab topology:
 *
 *                    CORE-01
 *            /          |          \
 *     NCS-540-01    NCS-540-02    NCS-540-03      (ISIS + iBGP AS 65000 to core)
 *         |             |      \______
 *    N9K-LEAF-01    N9K-LEAF-02 ------'           (eBGP to the NCS routers)
 */

const DEVICES = [
  { hostname: 'CORE-01', mgmtIp: '10.1.1.1', loopback: '10.255.0.1', platform: 'ASR-9906', role: 'core' },
  { hostname: 'NCS-540-01', mgmtIp: '10.1.1.11', loopback: '10.255.0.11', platform: 'NCS-540', role: 'aggregation' },
  { hostname: 'NCS-540-02', mgmtIp: '10.1.1.12', loopback: '10.255.0.12', platform: 'NCS-540', role: 'aggregation' },
  { hostname: 'NCS-540-03', mgmtIp: '10.1.1.13', loopback: '10.255.0.13', platform: 'NCS-540', role: 'aggregation' },
  { hostname: 'N9K-LEAF-01', mgmtIp: '10.1.1.21', loopback: '10.255.1.21', platform: 'Nexus 93180YC-FX', role: 'leaf' },
  { hostname: 'N9K-LEAF-02', mgmtIp: '10.1.1.22', loopback: '10.255.1.22', platform: 'Nexus 93180YC-FX', role: 'leaf' },
];

const LINKS = [
  { a: 'CORE-01', aIf: 'HundredGigE0/0/0/0', b: 'NCS-540-01', bIf: 'HundredGigE0/0/1/0', speed: 100000, isis: true },
  { a: 'CORE-01', aIf: 'HundredGigE0/0/0/1', b: 'NCS-540-02', bIf: 'HundredGigE0/0/1/0', speed: 100000, isis: true },
  { a: 'CORE-01', aIf: 'HundredGigE0/0/0/2', b: 'NCS-540-03', bIf: 'HundredGigE0/0/1/0', speed: 100000, isis: true },
  { a: 'NCS-540-01', aIf: 'TenGigE0/0/0/0', b: 'N9K-LEAF-01', bIf: 'Ethernet1/49', speed: 10000, isis: false },
  { a: 'NCS-540-02', aIf: 'TenGigE0/0/0/0', b: 'N9K-LEAF-02', bIf: 'Ethernet1/49', speed: 10000, isis: false },
  { a: 'NCS-540-03', aIf: 'TenGigE0/0/0/0', b: 'N9K-LEAF-02', bIf: 'Ethernet1/50', speed: 10000, isis: false },
];

// Server-facing ports with no peer device (good targets for interface-down).
const ACCESS_PORTS = [
  { host: 'N9K-LEAF-01', name: 'Ethernet1/1', description: 'Server rack A1' },
  { host: 'N9K-LEAF-01', name: 'Ethernet1/2', description: 'Server rack A2' },
  { host: 'N9K-LEAF-02', name: 'Ethernet1/1', description: 'Server rack B1' },
  { host: 'N9K-LEAF-02', name: 'Ethernet1/2', description: 'Server rack B2' },
];

const BGP_SESSIONS = [
  // iBGP over loopbacks
  { a: 'CORE-01', aIp: '10.255.0.1', aAs: 65000, b: 'NCS-540-01', bIp: '10.255.0.11', bAs: 65000 },
  { a: 'CORE-01', aIp: '10.255.0.1', aAs: 65000, b: 'NCS-540-02', bIp: '10.255.0.12', bAs: 65000 },
  { a: 'CORE-01', aIp: '10.255.0.1', aAs: 65000, b: 'NCS-540-03', bIp: '10.255.0.13', bAs: 65000 },
  // eBGP over point-to-point links
  { a: 'NCS-540-01', aIp: '10.20.1.0', aAs: 65000, b: 'N9K-LEAF-01', bIp: '10.20.1.1', bAs: 65101 },
  { a: 'NCS-540-02', aIp: '10.20.2.0', aAs: 65000, b: 'N9K-LEAF-02', bIp: '10.20.2.1', bAs: 65102 },
  { a: 'NCS-540-03', aIp: '10.20.3.0', aAs: 65000, b: 'N9K-LEAF-02', bIp: '10.20.3.1', bAs: 65102 },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function buildDevices() {
  const byHost = new Map(
    DEVICES.map((d) => [
      d.hostname,
      { ...d, cpu: randInt(15, 40), memory: randInt(40, 60), interfaces: [], bgpNeighbors: [], isisNeighbors: [] },
    ])
  );

  for (const l of LINKS) {
    byHost.get(l.a).interfaces.push({
      name: l.aIf, description: `To ${l.b} ${l.bIf}`, speedMbps: l.speed, peerDevice: l.b, peerInterface: l.bIf,
    });
    byHost.get(l.b).interfaces.push({
      name: l.bIf, description: `To ${l.a} ${l.aIf}`, speedMbps: l.speed, peerDevice: l.a, peerInterface: l.aIf,
    });
    if (l.isis) {
      byHost.get(l.a).isisNeighbors.push({ systemId: l.b, interface: l.aIf });
      byHost.get(l.b).isisNeighbors.push({ systemId: l.a, interface: l.bIf });
    }
  }

  for (const p of ACCESS_PORTS) {
    byHost.get(p.host).interfaces.push({ name: p.name, description: p.description, speedMbps: 10000 });
  }

  for (const s of BGP_SESSIONS) {
    byHost.get(s.a).bgpNeighbors.push({ address: s.bIp, remoteAs: s.bAs, peerDevice: s.b });
    byHost.get(s.b).bgpNeighbors.push({ address: s.aIp, remoteAs: s.aAs, peerDevice: s.a });
  }

  return [...byHost.values()];
}

module.exports = { buildDevices };
