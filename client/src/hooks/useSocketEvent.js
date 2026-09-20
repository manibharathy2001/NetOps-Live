import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

// Subscribe to one socket event for the lifetime of the component.
// The handler can change every render without re-subscribing.
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
