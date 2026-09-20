export const STATUS = {
  UP: { label: 'Up', dot: 'bg-up', text: 'text-up', stripe: 'border-l-up', flash: 'rgba(30, 142, 90, 0.22)' },
  DEGRADED: { label: 'Degraded', dot: 'bg-warn', text: 'text-warn', stripe: 'border-l-warn', flash: 'rgba(183, 121, 31, 0.25)' },
  DOWN: { label: 'Down', dot: 'bg-down', text: 'text-down', stripe: 'border-l-down', flash: 'rgba(197, 59, 59, 0.25)' },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.UP;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
