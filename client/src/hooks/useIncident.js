import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useSocketEvent } from './useSocketEvent.js';

/*
 * One incident, live:
 *  - joins the incident's Socket.io room (for comments and presence)
 *  - applies incident:updated / incident:comment as they arrive
 *  - sends the version it last saw with every edit; a 409 means someone
 *    else changed it first, so we reload and tell the user
 */
export function useIncident(id) {
  const { socket, connectionId } = useSocket();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [viewers, setViewers] = useState([]);

  const load = useCallback(async () => {
    try {
      setIncident(await api(`/api/incidents/${id}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, connectionId]);

  // Join the room. Re-join after a reconnect, because the server forgets rooms.
  useEffect(() => {
    if (!socket || !id) return undefined;
    socket.emit('incident:join', id);
    return () => {
      socket.emit('incident:leave', id);
      setViewers([]);
    };
  }, [socket, id, connectionId]);

  useSocketEvent('incident:updated', (updated) => {
    if (updated._id === id) setIncident(updated);
  });

  useSocketEvent('incident:comment', ({ incidentId, comment }) => {
    if (incidentId !== id) return;
    setIncident((current) => {
      if (!current || current.comments.some((c) => c._id === comment._id)) return current;
      return {
        ...current,
        comments: [...current.comments, comment],
        timeline: [...current.timeline, { at: comment.createdAt, actor: comment.authorName, action: 'commented' }],
      };
    });
  });

  useSocketEvent('incident:presence', (p) => {
    if (p.incidentId === id) setViewers(p.viewers);
  });

  const update = useCallback(
    async (changes) => {
      setNotice(null);
      try {
        const updated = await api(`/api/incidents/${id}`, {
          method: 'PATCH',
          body: { ...changes, version: incident.__v },
        });
        setIncident(updated);
        return true;
      } catch (err) {
        if (err.status === 409) {
          setNotice('Someone else changed this incident at the same time. The latest version is shown; apply your change again if it is still needed.');
          await load();
        } else {
          setNotice(err.message);
        }
        return false;
      }
    },
    [id, incident?.__v, load]
  );

  const addComment = useCallback(
    async (text) => {
      setNotice(null);
      try {
        const comment = await api(`/api/incidents/${id}/comments`, { method: 'POST', body: { text } });
        // The socket event normally arrives first; this is a fallback. Duplicates are ignored.
        setIncident((current) =>
          current && !current.comments.some((c) => c._id === comment._id)
            ? { ...current, comments: [...current.comments, comment] }
            : current
        );
        return true;
      } catch (err) {
        setNotice(err.message);
        return false;
      }
    },
    [id]
  );

  return { incident, loading, error, notice, viewers, update, addComment };
}
