import { formatBps } from './format.js';

// Vertical tier for each role: core on top, leaves at the bottom.
export const TIER = { core: 0, spine: 1, aggregation: 1, leaf: 2 };
const tierOf = (d) => TIER[d.role] ?? 1;

const X_GAP = 250;
const Y_GAP = 190;

// Default layout: core and aggregation rows are centred;
// each leaf sits under the average position of the routers it connects to.
export function defaultPositions(devices) {
  const positions = {};
  const tiers = new Map();
  for (const d of devices) {
    const t = tierOf(d);
    if (!tiers.has(t)) tiers.set(t, []);
    tiers.get(t).push(d);
  }

  for (const t of [...tiers.keys()].sort()) {
    const row = tiers.get(t).sort((a, b) => a.hostname.localeCompare(b.hostname));

    if (t < 2) {
      row.forEach((d, i) => {
        positions[d.hostname] = { x: (i - (row.length - 1) / 2) * X_GAP, y: t * Y_GAP };
      });
      continue;
    }

    const placed = row
      .map((d) => {
        const parents = d.interfaces.map((i) => positions[i.peerDevice]).filter(Boolean);
        const x = parents.length ? parents.reduce((s, p) => s + p.x, 0) / parents.length : 0;
        return { hostname: d.hostname, x };
      })
      .sort((a, b) => a.x - b.x);

    placed.forEach((p, i) => {
      if (i > 0 && p.x < placed[i - 1].x + X_GAP - 30) p.x = placed[i - 1].x + X_GAP - 30;
      positions[p.hostname] = { x: p.x, y: t * Y_GAP };
    });
  }
  return positions;
}

// One entry per physical link, built from interface peer info.
// "a" is always the upper-tier end so edges run top to bottom.
export function buildLinks(devices) {
  const byHost = new Map(devices.map((d) => [d.hostname, d]));
  const seen = new Set();
  const links = [];

  for (const d of devices) {
    for (const iface of d.interfaces) {
      if (!iface.peerDevice) continue;
      const peer = byHost.get(iface.peerDevice);
      if (!peer) continue;
      const id = [`${d.hostname}:${iface.name}`, `${peer.hostname}:${iface.peerInterface}`].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id);

      const peerIface = peer.interfaces.find((i) => i.name === iface.peerInterface);
      let [a, aIface, b, bIface] = [d, iface, peer, peerIface];
      if (tierOf(a) > tierOf(b)) [a, aIface, b, bIface] = [b, bIface, a, aIface];

      const up =
        a.status !== 'DOWN' &&
        b.status !== 'DOWN' &&
        aIface?.operStatus === 'up' &&
        bIface?.operStatus === 'up';

      links.push({
        id,
        a: a.hostname,
        b: b.hostname,
        aIface,
        bIface,
        speedMbps: aIface?.speedMbps || bIface?.speedMbps || 0,
        up,
        // Traffic from a's point of view
        downBps: up ? aIface.outBps : 0, // a -> b
        upBps: up ? aIface.inBps : 0, // b -> a
      });
    }
  }
  return links;
}

const EDGE_UP = '#8494a7';
const EDGE_DOWN = '#c53b3b';
const EDGE_SELECTED = '#1f4e9c';

export function toEdges(links, selectedId) {
  return links.map((l) => {
    const selected = l.id === selectedId;
    return {
      id: l.id,
      source: l.a,
      target: l.b,
      type: 'straight',
      style: {
        stroke: !l.up ? EDGE_DOWN : selected ? EDGE_SELECTED : EDGE_UP,
        strokeWidth: (l.speedMbps >= 100000 ? 3 : 1.75) + (selected ? 1 : 0),
        strokeDasharray: l.up ? undefined : '6 4',
      },
      label: l.up ? formatBps(Math.max(l.downBps, l.upBps)) : 'Link down',
      labelStyle: {
        fill: l.up ? '#5b6778' : EDGE_DOWN,
        fontSize: 11,
        fontWeight: l.up ? 400 : 600,
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      },
      labelBgStyle: { fill: '#edf0f3' },
      labelBgPadding: [5, 2],
      labelBgBorderRadius: 3,
      interactionWidth: 18,
    };
  });
}