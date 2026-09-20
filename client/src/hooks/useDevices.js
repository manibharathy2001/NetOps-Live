import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useSocketEvent } from './useSocketEvent.js';

const replaceBy = (list, key, item) => list.map((x) => (x[key] === item[key] ? item : x));

/*
 * REST for the initial state, Socket.io events for every change after that.
 * Refetches whenever the socket (re)connects.
 */
export function useDevices() {
  const { connectionId } = useSocket();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // hostname -> timestamp of the last state change (drives the row flash)
  const [changedAt, setChangedAt] = useState({});

  useEffect(() => {
    let cancelled = false;
    api('/api/devices')
      .then((data) => {
        if (cancelled) return;
        setDevices(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  const patch = useCallback((hostname, update) => {
    setDevices((list) => list.map((d) => (d.hostname === hostname ? update(d) : d)));
  }, []);

  const markChanged = useCallback((hostname) => {
    setChangedAt((m) => ({ ...m, [hostname]: Date.now() }));
  }, []);

  useSocketEvent('device:status', (p) => {
    patch(p.hostname, (d) => ({ ...d, status: p.status, lastEvent: p.lastEvent || d.lastEvent }));
    markChanged(p.hostname);
  });

  // Metrics are partial: merge only the fields that are present.
  useSocketEvent('device:metrics', (p) => {
    const updates = new Map(p.devices.map((m) => [m.hostname, m]));
    setDevices((list) =>
      list.map((d) => {
        const m = updates.get(d.hostname);
        if (!m) return d;
        const next = { ...d };
        if (m.cpu !== undefined) next.cpu = m.cpu;
        if (m.memory !== undefined) next.memory = m.memory;
        if (m.lastSeen) next.lastSeen = m.lastSeen;
        if (m.interfaces?.length) {
          const traffic = new Map(m.interfaces.map((i) => [i.name, i]));
          next.interfaces = d.interfaces.map((i) =>
            traffic.has(i.name) ? { ...i, inBps: traffic.get(i.name).inBps, outBps: traffic.get(i.name).outBps } : i
          );
        }
        return next;
      })
    );
  });

  useSocketEvent('device:interface', (p) => {
    patch(p.hostname, (d) => ({
      ...d,
      interfaces: replaceBy(d.interfaces, 'name', p.interface),
      lastEvent: p.lastEvent,
    }));
    markChanged(p.hostname);
  });

  useSocketEvent('device:bgp', (p) => {
    patch(p.hostname, (d) => ({
      ...d,
      bgpNeighbors: replaceBy(d.bgpNeighbors, 'address', p.neighbor),
      lastEvent: p.lastEvent,
    }));
    markChanged(p.hostname);
  });

  useSocketEvent('device:isis', (p) => {
    patch(p.hostname, (d) => ({
      ...d,
      isisNeighbors: replaceBy(d.isisNeighbors, 'systemId', p.neighbor),
      lastEvent: p.lastEvent,
    }));
    markChanged(p.hostname);
  });

  return { devices, loading, error, changedAt };
}
