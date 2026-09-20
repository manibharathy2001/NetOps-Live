import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { FILTERS } from '../lib/incidents.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useSocketEvent } from './useSocketEvent.js';

// Incident list for one filter, kept live by incident:created / incident:updated.
export function useIncidents(filterKey) {
  const { connectionId } = useSocket();
  const statuses = FILTERS[filterKey]?.statuses ?? null;
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changedAt, setChangedAt] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = statuses ? `?status=${statuses.join(',')}` : '';
    api(`/api/incidents${query}`)
      .then((data) => {
        if (cancelled) return;
        setIncidents(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filterKey, connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = (incident) => !statuses || statuses.includes(incident.status);
  const mark = (id) => setChangedAt((m) => ({ ...m, [id]: Date.now() }));

  useSocketEvent('incident:created', (incident) => {
    if (!matches(incident)) return;
    setIncidents((list) => (list.some((i) => i._id === incident._id) ? list : [incident, ...list]));
    mark(incident._id);
  });

  // Updated incidents move to the top (the list is sorted by last update),
  // or drop out if they no longer match the filter (e.g. just closed).
  useSocketEvent('incident:updated', (incident) => {
    setIncidents((list) => {
      const others = list.filter((i) => i._id !== incident._id);
      return matches(incident) ? [incident, ...others] : others;
    });
    mark(incident._id);
  });

  return { incidents, loading, error, changedAt };
}
