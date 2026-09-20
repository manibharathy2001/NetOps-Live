import { useEffect, useRef } from 'react';
import StatusBadge, { STATUS } from './StatusBadge.jsx';
import UsageBar from './UsageBar.jsx';
import DeviceDetail from './DeviceDetail.jsx';
import { SEVERITY_RANK, SEVERITY_STYLE, timeAgo } from '../lib/format.js';

const COLUMN_COUNT = 8;
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function DeviceRow({ device, alarms, changedAt, expanded, onToggle, now }) {
  const rowRef = useRef(null);
  const s = STATUS[device.status] || STATUS.UP;
  const isDown = device.status === 'DOWN';

  // The one deliberate animation on the page: when a device's state changes
  // from a live event, its row flashes in the new status colour.
  useEffect(() => {
    if (!changedAt || !rowRef.current || prefersReducedMotion()) return;
    rowRef.current.animate(
      [{ backgroundColor: s.flash }, { backgroundColor: 'transparent' }],
      { duration: 2200, easing: 'ease-out' }
    );
  }, [changedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const worstAlarm = [...alarms].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
  const ifUp = device.interfaces.filter((i) => i.operStatus === 'up').length;
  const bgpUp = device.bgpNeighbors.filter((n) => n.state === 'Established').length;
  const detailId = `detail-${device.hostname}`;

  return (
    <>
      <tr
        ref={rowRef}
        onClick={onToggle}
        className="cursor-pointer border-t border-line hover:bg-canvas/50"
      >
        <td className={`border-l-4 py-3 pr-4 pl-4 ${s.stripe}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-expanded={expanded}
            aria-controls={detailId}
            className="text-left"
          >
            <span className="block font-mono font-medium">{device.hostname}</span>
            <span className="block text-xs text-muted">{device.platform}</span>
          </button>
          {worstAlarm && (
            <span className={`mt-1 block max-w-[28ch] truncate text-xs ${SEVERITY_STYLE[worstAlarm.severity].text}`}>
              {worstAlarm.message}
            </span>
          )}
        </td>
        <td className="py-3 pr-4">
          <StatusBadge status={device.status} />
        </td>
        <td className="hidden py-3 pr-4 font-mono text-sm md:table-cell">{device.mgmtIp}</td>
        <td className="py-3 pr-4">
          <UsageBar value={device.cpu} warnAt={75} critAt={85} disabled={isDown} />
        </td>
        <td className="hidden py-3 pr-4 sm:table-cell">
          <UsageBar value={device.memory} warnAt={80} critAt={90} disabled={isDown} />
        </td>
        <td className={`hidden py-3 pr-4 text-sm tabular-nums lg:table-cell ${ifUp < device.interfaces.length ? 'text-down' : ''}`}>
          {ifUp}/{device.interfaces.length} up
        </td>
        <td className={`hidden py-3 pr-4 text-sm tabular-nums lg:table-cell ${bgpUp < device.bgpNeighbors.length ? 'text-down' : ''}`}>
          {bgpUp}/{device.bgpNeighbors.length}
        </td>
        <td className={`hidden py-3 pr-4 text-sm whitespace-nowrap md:table-cell ${isDown ? 'text-down' : 'text-muted'}`}>
          {timeAgo(device.lastSeen, now)}
        </td>
      </tr>
      {expanded && (
        <tr id={detailId}>
          <td colSpan={COLUMN_COUNT} className="border-t border-line p-0">
            <DeviceDetail device={device} now={now} />
          </td>
        </tr>
      )}
    </>
  );
}
