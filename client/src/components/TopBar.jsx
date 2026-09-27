import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, ListChecks, LogOut, Share2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const CONNECTION = {
  live: { label: 'Live', dot: 'bg-up', text: 'text-up' },
  connecting: { label: 'Connecting', dot: 'bg-warn', text: 'text-warn' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn', text: 'text-warn' },
};

const NAV = [
  { to: '/', end: true, label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/topology', end: false, label: 'Topology', Icon: Share2 },
  { to: '/incidents', end: false, label: 'Incidents', Icon: ListChecks },
];

const navClass = ({ isActive }) =>
  `flex items-center gap-2 border-b-2 px-1 py-3.5 text-sm font-medium ${
    isActive ? 'border-action text-ink' : 'border-transparent text-muted hover:text-ink'
  }`;

export default function TopBar() {
  const { user, logout } = useAuth();
  const { status } = useSocket();
  const [demoMode, setDemoMode] = useState(false);
  const c = CONNECTION[status];

  // The server tells us whether it is generating events on its own.
  useEffect(() => {
    api('/api/config')
      .then((cfg) => setDemoMode(Boolean(cfg.demoMode)))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-action text-white">
              <Activity size={16} aria-hidden="true" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">NetOps Live</span>
          </span>
          <nav className="flex gap-5" aria-label="Main">
            {NAV.map(({ to, end, label, Icon }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon size={15} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-sm sm:gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium ${c.text}`}
            role="status"
            title={status === 'live' ? 'Receiving updates in real time' : 'Trying to reach the server'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
            {c.label}
          </span>
          {demoMode && (
            <span
              className="hidden rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted sm:inline"
              title="This demo generates random network events by itself, roughly once a minute"
            >
              Demo mode
            </span>
          )}
          <span className="hidden text-muted lg:inline">
            {user.name}, {user.role}
          </span>
          <ThemeToggle />
          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
