const SEVERITIES = ['critical', 'major', 'minor', 'warning'];
const SEVERITY_RANK = { critical: 4, major: 3, minor: 2, warning: 1 };

const INCIDENT_STATUSES = ['Open', 'Investigating', 'Resolved', 'Closed'];

// Which status changes are allowed. Closed -> Investigating is a "reopen".
const STATUS_TRANSITIONS = {
  Open: ['Investigating', 'Resolved', 'Closed'],
  Investigating: ['Open', 'Resolved', 'Closed'],
  Resolved: ['Investigating', 'Closed'],
  Closed: ['Investigating'],
};

// Hysteresis: raise at one value, clear at a lower one, so an alarm
// doesn't flap when CPU hovers around a single threshold.
const THRESHOLDS = {
  cpu: { raise: 85, clear: 75 },
  memory: { raise: 90, clear: 80 },
};

const ROOMS = {
  DASHBOARD: 'dashboard',
  incident: (id) => `incident:${id}`,
};

module.exports = { SEVERITIES, SEVERITY_RANK, INCIDENT_STATUSES, STATUS_TRANSITIONS, THRESHOLDS, ROOMS };
