import { useState } from 'react';
import DeviceRow from './DeviceRow.jsx';
import { useNow } from '../hooks/useNow.js';

export default function DeviceTable({ devices, alarmsByHost, changedAt }) {
  const [expanded, setExpanded] = useState(null);
  const now = useNow(1000);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className="text-sm text-muted">
            <th className="py-2 pr-4 pl-5 font-medium">Device</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="hidden py-2 pr-4 font-medium md:table-cell">Management IP</th>
            <th className="py-2 pr-4 font-medium">CPU</th>
            <th className="hidden py-2 pr-4 font-medium sm:table-cell">Memory</th>
            <th className="hidden py-2 pr-4 font-medium lg:table-cell">Interfaces</th>
            <th className="hidden py-2 pr-4 font-medium lg:table-cell">BGP</th>
            <th className="hidden py-2 pr-4 font-medium md:table-cell">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow
              key={device.hostname}
              device={device}
              alarms={alarmsByHost[device.hostname] || []}
              changedAt={changedAt[device.hostname]}
              expanded={expanded === device.hostname}
              onToggle={() => setExpanded((h) => (h === device.hostname ? null : device.hostname))}
              now={now}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
