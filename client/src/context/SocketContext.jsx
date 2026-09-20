import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const AUTH_ERRORS = /token|authentication|no longer exists/i;

export function SocketProvider({ children }) {
  const { session, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | live | reconnecting
  // Increments on every (re)connect. Hooks refetch REST data when it changes,
  // so nothing that happened while we were disconnected is missed.
  const [connectionId, setConnectionId] = useState(0);

  useEffect(() => {
    if (!session?.token) return undefined;

    const s = io(API_URL, { auth: { token: session.token } });

    s.on('connect', () => {
      setStatus('live');
      setConnectionId((n) => n + 1);
    });

    s.on('disconnect', (reason) => {
      setStatus('reconnecting');
      // If the server closed the connection, socket.io won't retry by itself.
      if (reason === 'io server disconnect') s.connect();
    });

    s.on('connect_error', (err) => {
      setStatus('reconnecting');
      if (AUTH_ERRORS.test(err.message)) logout();
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [session?.token, logout]);

  return (
    <SocketContext.Provider value={{ socket, status, connectionId }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
}
