export const SEVERITIES = ['critical', 'major', 'minor', 'warning'];

// Must match server/config/constants.js
export const STATUS_TRANSITIONS = {
  Open: ['Investigating', 'Resolved', 'Closed'],
  Investigating: ['Open', 'Resolved', 'Closed'],
  Resolved: ['Investigating', 'Closed'],
  Closed: ['Investigating'],
};

export const INCIDENT_STATUS_STYLE = {
  Open: { text: 'text-down', dot: 'bg-down' },
  Investigating: { text: 'text-warn', dot: 'bg-warn' },
  Resolved: { text: 'text-up', dot: 'bg-up' },
  Closed: { text: 'text-muted', dot: 'bg-muted' },
};

export const FILTERS = {
  open: { label: 'Open', statuses: ['Open', 'Investigating'] },
  resolved: { label: 'Resolved', statuses: ['Resolved'] },
  closed: { label: 'Closed', statuses: ['Closed'] },
  all: { label: 'All', statuses: null },
};

const who = (actor) => (actor === 'system' ? 'System' : actor);

// Turns a timeline entry into a readable sentence.
export function describeTimelineEntry(e) {
  const actor = who(e.actor);
  switch (e.action) {
    case 'created':
      return e.actor === 'system' ? `System opened the incident. ${e.note || ''}` : `${actor} opened the incident`;
    case 'assigned':
      return e.from ? `${actor} reassigned it from ${e.from} to ${e.to}` : `${actor} assigned it to ${e.to}`;
    case 'unassigned':
      return `${actor} removed ${e.from} as assignee`;
    case 'status_changed':
      return `${actor} changed status from ${e.from} to ${e.to}`;
    case 'severity_changed':
      return `${actor} changed severity from ${e.from} to ${e.to}${e.note ? `. ${e.note}` : ''}`;
    case 'title_changed':
      return `${actor} renamed it to "${e.to}"`;
    case 'commented':
      return `${actor} added a comment`;
    case 'alarm_linked':
      return `Alarm attached: ${e.note}`;
    case 'alarm_cleared':
      return `Alarm cleared: ${e.note}`;
    default:
      return `${actor}: ${e.action}`;
  }
}
