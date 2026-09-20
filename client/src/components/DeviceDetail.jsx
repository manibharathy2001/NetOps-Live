import { clockTime, formatBps, formatSpeed, timeAgo } from '../lib/format.js';

const stateColour = (ok) => (ok ? 'text-up' : 'text-down');

function MiniTable({ caption, headers, children, empty }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-sm font-semibold">{caption}</h4>
      {empty ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                {headers.map((h) => (
                  <th key={h} className="py-1 pr-4 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DeviceDetail({ device, now }) {
  return (
    <div className="grid gap-6 bg-canvas/60 px-5 py-4 xl:grid-cols-[3fr_2fr]">
      <MiniTable caption="Interfaces" headers={['Interface', 'Description', 'State', 'Speed', 'In', 'Out']}>
        {device.interfaces.map((i) => (
          <tr key={i.name} className="border-t border-line/70">
            <td className="py-1 pr-4 font-mono whitespace-nowrap">{i.name}</td>
            <td className="py-1 pr-4 text-muted">{i.description || 'No description'}</td>
            <td className={`py-1 pr-4 font-medium ${stateColour(i.operStatus === 'up')}`}>
              {i.operStatus === 'up' ? 'Up' : 'Down'}
            </td>
            <td className="py-1 pr-4 tabular-nums">{formatSpeed(i.speedMbps)}</td>
            <td className="py-1 pr-4 tabular-nums whitespace-nowrap">{formatBps(i.inBps)}</td>
            <td className="py-1 pr-4 tabular-nums whitespace-nowrap">{formatBps(i.outBps)}</td>
          </tr>
        ))}
      </MiniTable>

      <div className="space-y-5">
        <MiniTable
          caption="BGP neighbors"
          headers={['Neighbor', 'AS', 'Peer', 'State', 'Since']}
          empty={device.bgpNeighbors.length ? null : 'No BGP neighbors configured.'}
        >
          {device.bgpNeighbors.map((n) => (
            <tr key={n.address} className="border-t border-line/70">
              <td className="py-1 pr-4 font-mono">{n.address}</td>
              <td className="py-1 pr-4 tabular-nums">{n.remoteAs}</td>
              <td className="py-1 pr-4 font-mono">{n.peerDevice}</td>
              <td className={`py-1 pr-4 font-medium ${stateColour(n.state === 'Established')}`}>{n.state}</td>
              <td className="py-1 pr-4 text-muted whitespace-nowrap">{timeAgo(n.stateSince, now)}</td>
            </tr>
          ))}
        </MiniTable>

        <MiniTable
          caption="ISIS adjacencies"
          headers={['Neighbor', 'Interface', 'State']}
          empty={device.isisNeighbors.length ? null : 'ISIS is not running on this device.'}
        >
          {device.isisNeighbors.map((n) => (
            <tr key={n.systemId} className="border-t border-line/70">
              <td className="py-1 pr-4 font-mono">{n.systemId}</td>
              <td className="py-1 pr-4 font-mono">{n.interface}</td>
              <td className={`py-1 pr-4 font-medium ${stateColour(n.state === 'Up')}`}>{n.state}</td>
            </tr>
          ))}
        </MiniTable>

        <div>
          <h4 className="mb-1 text-sm font-semibold">Last event</h4>
          {device.lastEvent?.message ? (
            <p className="text-sm">
              {device.lastEvent.message}
              <span className="ml-2 text-muted">at {clockTime(device.lastEvent.at)}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">No events since the network was seeded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
