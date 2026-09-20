export default function StatusSummary({ devices, alarmCount }) {
  const count = (status) => devices.filter((d) => d.status === status).length;
  const items = [
    { label: 'Up', value: count('UP'), dot: 'bg-up' },
    { label: 'Degraded', value: count('DEGRADED'), dot: 'bg-warn' },
    { label: 'Down', value: count('DOWN'), dot: 'bg-down' },
    { label: 'Active alarms', value: alarmCount, dot: alarmCount ? 'bg-down' : 'bg-line' },
  ];

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      <div className="flex items-baseline gap-2">
        <dt className="text-sm text-muted">Devices</dt>
        <dd className="text-xl font-semibold tabular-nums">{devices.length}</dd>
      </div>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <dt className="flex items-center gap-1.5 text-sm text-muted">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
            {item.label}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
