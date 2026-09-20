import { SEVERITY_STYLE } from '../lib/format.js';
import { INCIDENT_STATUS_STYLE } from '../lib/incidents.js';

export function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.minor;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-sm ${s.bar}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function IncidentStatusBadge({ status }) {
  const s = INCIDENT_STATUS_STYLE[status] || INCIDENT_STATUS_STYLE.Open;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
