// Horizontal utilisation bar. Colour follows the same thresholds as the alarms.
export default function UsageBar({ value, warnAt, critAt, disabled }) {
  if (disabled || value === undefined || value === null) {
    return <span className="text-sm text-muted">n/a</span>;
  }
  const colour = value >= critAt ? 'bg-down' : value >= warnAt ? 'bg-warn' : 'bg-up';
  const textColour = value >= critAt ? 'text-down' : value >= warnAt ? 'text-warn' : 'text-ink';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={`h-full rounded-full ${colour} transition-[width] duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className={`w-9 text-right text-sm tabular-nums ${textColour}`}>{value}%</span>
    </div>
  );
}
