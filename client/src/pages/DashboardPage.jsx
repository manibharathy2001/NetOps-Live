import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { useAlarms } from '../hooks/useAlarms.js';
import StatusSummary from '../components/StatusSummary.jsx';
import DeviceTable from '../components/DeviceTable.jsx';
import AlarmFeed from '../components/AlarmFeed.jsx';
import SimulatorPanel from '../components/SimulatorPanel.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const { devices, loading, error, changedAt } = useDevices();
  const { alarms, cleared } = useAlarms();

  const alarmsByHost = useMemo(() => {
    const map = {};
    for (const a of alarms) (map[a.hostname] ||= []).push(a);
    return map;
  }, [alarms]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <StatusSummary devices={devices} alarmCount={alarms.length} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="devices-heading" className="rounded-lg border border-line bg-panel">
          <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
            <h2 id="devices-heading" className="font-semibold">Devices</h2>
            <span className="text-sm text-muted">Select a device to see interfaces and neighbors</span>
          </div>

          {loading && <p className="px-5 py-6 text-sm text-muted">Loading devices…</p>}
          {error && (
            <p className="px-5 py-6 text-sm text-down" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && devices.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">
              No devices yet. Run <code className="font-mono">npm run seed</code> in the server folder.
            </p>
          )}
          {devices.length > 0 && (
            <DeviceTable devices={devices} alarmsByHost={alarmsByHost} changedAt={changedAt} />
          )}
        </section>

        <aside className="space-y-5">
          <AlarmFeed alarms={alarms} cleared={cleared} />
          {user.role !== 'viewer' && <SimulatorPanel devices={devices} />}
        </aside>
      </div>
    </main>
  );
}
