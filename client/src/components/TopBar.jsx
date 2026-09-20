import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const CONNECTION = {
  live: { label: 'Live', dot: 'bg-up', text: 'text-up' },
  connecting: { label: 'Connecting', dot: 'bg-warn', text: 'text-warn' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn', text: 'text-warn' },
};

export default function TopBar() {
  const { user, logout } = useAuth();
  const { status } = useSocket();
  const c = CONNECTION[status];

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight">NetOps Live</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium ${c.text}`}
            role="status"
            title={status === 'live' ? 'Receiving updates in real time' : 'Trying to reach the server'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
            {c.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted sm:inline">
            {user.name}, {user.role}
          </span>
          <button onClick={logout} className="rounded-md px-2 py-1 font-medium text-action hover:bg-canvas">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
