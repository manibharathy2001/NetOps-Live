import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useSocketEvent } from './useSocketEvent.js';

export function useAlarms() {
  const { connectionId } = useSocket();
  const [alarms, setAlarms] = useState([]);
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api('/api/alarms?active=true')
      .then((data) => !cancelled && setAlarms(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  useSocketEvent('alarm:raised', (alarm) => {
    setAlarms((list) => (list.some((a) => a._id === alarm._id) ? list : [alarm, ...list]));
  });

  useSocketEvent('alarm:cleared', (alarm) => {
    setAlarms((list) => list.filter((a) => a._id !== alarm._id));
    setCleared((list) => [alarm, ...list.filter((a) => a._id !== alarm._id)].slice(0, 5));
  });

  // alarm:raised arrives before the server links the alarm to an incident,
  // so pick up the link from the incident events.
  const linkToIncident = (incident) => {
    const ids = new Set(incident.alarms || []);
    setAlarms((list) => list.map((a) => (ids.has(a._id) && !a.incident ? { ...a, incident: incident._id } : a)));
  };
  useSocketEvent('incident:created', linkToIncident);
  useSocketEvent('incident:updated', linkToIncident);

  return { alarms, cleared };
}
