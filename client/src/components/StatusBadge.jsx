export const STATUS = {
  UP: { label: 'Up', dot: 'bg-up', text: 'text-up', stripe: 'border-l-up', flash: 'color-mix(in srgb, var(--color-up) 22%, transparent)' },
  DEGRADED: { label: 'Degraded', dot: 'bg-warn', text: 'text-warn', stripe: 'border-l-warn', flash: 'color-mix(in srgb, var(--color-warn) 25%, transparent)' },
  DOWN: { label: 'Down', dot: 'bg-down', text: 'text-down', stripe: 'border-l-down', flash: 'color-mix(in srgb, var(--color-down) 25%, transparent)' },
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
