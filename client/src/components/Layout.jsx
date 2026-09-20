import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import IncidentToasts from './IncidentToasts.jsx';

// Shared frame for every signed-in page. Toasts show on any page.
export default function Layout() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <Outlet />
      <IncidentToasts />
    </div>
  );
}
