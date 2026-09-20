import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge.jsx';
import { SEVERITY_STYLE, clockTime, formatBps, formatSpeed, timeAgo } from '../../lib/format.js';

const okText = (ok) => (ok ? 'text-up' : 'text-down');

function Section({ title, children }) {
  return (
    <div className="border-t border-line px-4 py-3">
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Facts({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className={mono ? 'font-mono' : ''}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DeviceDetails({ device, alarms, now }) {
  const isDown = device.status === 'DOWN';
  return (
    <>
      <div className="px-4 py-3">
        <p className="font-mono text-lg font-medium">{device.hostname}</p>
        <StatusBadge status={device.status} />
      </div>

      <Section title="Overview">
        <Facts
          rows={[
            ['Management IP', device.mgmtIp, true],
            ['Loopback', device.loopback || 'None', true],
            ['Platform', device.platform],
            ['Role', device.role],
            ['CPU', isDown ? 'n/a' : `${device.cpu}%`],
            ['Memory', isDown ? 'n/a' : `${device.memory}%`],
            ['Last seen', timeAgo(device.lastSeen, now)],
          ]}
        />
      </Section>

      {alarms.length > 0 && (
        <Section title={`Active alarms (${alarms.length})`}>
          <ul className="space-y-1.5">
            {alarms.map((a) => (
              <li key={a._id} className="text-sm">
                <span className={`font-medium ${SEVERITY_STYLE[a.severity].text}`}>{SEVERITY_STYLE[a.severity].label}</span>{' '}
                {a.message}
                {a.incident && (
                  <Link to={`/incidents/${a.incident}`} className="ml-1 text-action hover:underline">View incident</Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Interfaces">
        <ul className="space-y-1.5">
          {device.interfaces.map((i) => (
            <li key={i.name} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-mono">{i.name}</span>
                <span className={`font-medium ${okText(i.operStatus === 'up')}`}>{i.operStatus === 'up' ? 'Up' : 'Down'}</span>
              </div>
              <p className="text-xs text-muted">
                {i.peerDevice ? `To ${i.peerDevice} ${i.peerInterface}` : i.description || 'No description'}
                {i.operStatus === 'up' && `, in ${formatBps(i.inBps)}, out ${formatBps(i.outBps)}`}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="BGP neighbors">
        {device.bgpNeighbors.length === 0 ? (
          <p className="text-sm text-muted">None configured.</p>
        ) : (
          <ul className="space-y-1">
            {device.bgpNeighbors.map((n) => (
              <li key={n.address} className="flex justify-between gap-2 text-sm">
                <span>
                  <span className="font-mono">{n.address}</span>
                  <span className="ml-1.5 text-muted">AS {n.remoteAs}</span>
                </span>
                <span className={`font-medium ${okText(n.state === 'Established')}`}>{n.state}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="ISIS adjacencies">
        {device.isisNeighbors.length === 0 ? (
          <p className="text-sm text-muted">ISIS is not running on this device.</p>
        ) : (
          <ul className="space-y-1">
            {device.isisNeighbors.map((n) => (
              <li key={n.systemId} className="flex justify-between gap-2 text-sm">
                <span className="font-mono">{n.systemId}</span>
                <span className={`font-medium ${okText(n.state === 'Up')}`}>{n.state}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Last event">
        {device.lastEvent?.message ? (
          <p className="text-sm">
            {device.lastEvent.message}
            <span className="block text-xs text-muted">at {clockTime(device.lastEvent.at)}</span>
          </p>
        ) : (
          <p className="text-sm text-muted">No events since the network was seeded.</p>
        )}
        <Link
          to={`/incidents/new?device=${encodeURIComponent(device.hostname)}`}
          className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas"
        >
          Open an incident for {device.hostname}
        </Link>
      </Section>
    </>
  );
}

function LinkDetails({ link }) {
  const end = (host, iface) => (
    <div className="text-sm">
      <p>
        <span className="font-mono font-medium">{host}</span>
      </p>
      <p className="flex justify-between gap-2">
        <span className="font-mono text-muted">{iface?.name}</span>
        <span className={`font-medium ${okText(iface?.operStatus === 'up')}`}>{iface?.operStatus === 'up' ? 'Up' : 'Down'}</span>
      </p>
    </div>
  );

  return (
    <>
      <div className="px-4 py-3">
        <p className="font-semibold">Link</p>
        <p className={`text-sm font-medium ${okText(link.up)}`}>{link.up ? 'Up' : 'Down'}</p>
      </div>
      <Section title="Ends">
        <div className="space-y-3">
          {end(link.a, link.aIface)}
          {end(link.b, link.bIface)}
        </div>
      </Section>
      <Section title="Traffic">
        <Facts
          rows={[
            ['Speed', formatSpeed(link.speedMbps)],
            [`${link.a} to ${link.b}`, formatBps(link.downBps)],
            [`${link.b} to ${link.a}`, formatBps(link.upBps)],
          ]}
        />
      </Section>
    </>
  );
}

export default function TopologyPanel({ devices, selection, links, alarmsByHost, onSelect, now }) {
  const device = selection?.kind === 'device' ? devices.find((d) => d.hostname === selection.id) : null;
  const link = selection?.kind === 'link' ? links.find((l) => l.id === selection.id) : null;

  return (
    <aside className="flex max-h-[calc(100vh-170px)] min-h-[300px] flex-col rounded-lg border border-line bg-panel" aria-label="Selection details">
      <div className="border-b border-line px-4 py-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Device</span>
          <select
            value={device?.hostname || ''}
            onChange={(e) => onSelect(e.target.value ? { kind: 'device', id: e.target.value } : null)}
            className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-sm"
          >
            <option value="">Select a device</option>
            {devices.map((d) => (
              <option key={d.hostname} value={d.hostname}>{d.hostname}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-y-auto">
        {device && <DeviceDetails device={device} alarms={alarmsByHost[device.hostname] || []} now={now} />}
        {link && <LinkDetails link={link} />}
        {!device && !link && (
          <p className="px-4 py-6 text-sm text-muted">
            Click a device or a link in the diagram to see its details. Drag devices to rearrange the layout.
          </p>
        )}
      </div>
    </aside>
  );
}
