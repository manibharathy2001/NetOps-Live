import { SEVERITY_STYLE, timeAgo } from '../lib/format.js';
import { useNow } from '../hooks/useNow.js';

export default function AlarmFeed({ alarms, cleared }) {
  const now = useNow(5000);

  return (
    <section aria-labelledby="alarms-heading" className="rounded-lg border border-line bg-panel">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 id="alarms-heading" className="font-semibold">Active alarms</h2>
        <span className="text-sm tabular-nums text-muted">{alarms.length}</span>
      </div>

      {alarms.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">
          No active alarms. Take a device down in the simulator to raise one.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto" aria-live="polite">
          {alarms.map((alarm) => {
            const sev = SEVERITY_STYLE[alarm.severity] || SEVERITY_STYLE.minor;
            return (
              <li key={alarm._id} className="flex gap-3 px-4 py-3">
                <span className={`w-1 shrink-0 rounded-full ${sev.bar}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{alarm.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    <span className={`font-medium ${sev.text}`}>{sev.label}</span>
                    <span className="mx-1.5">on</span>
                    <span className="font-mono">{alarm.hostname}</span>
                    <span className="ml-1.5">{timeAgo(alarm.raisedAt, now)}</span>
                    {alarm.incident && <span className="ml-1.5">, tracked in an incident</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cleared.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <h3 className="mb-1.5 text-sm font-medium text-muted">Recently cleared</h3>
          <ul className="space-y-1">
            {cleared.map((alarm) => (
              <li key={alarm._id} className="truncate text-xs text-muted">
                <span className="text-up">Cleared</span> {alarm.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
