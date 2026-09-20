export function formatBps(bps) {
  if (!bps) return '0 b/s';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gb/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(0)} Mb/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} kb/s`;
  return `${bps} b/s`;
}

export function formatSpeed(mbps) {
  return mbps >= 1000 ? `${mbps / 1000}G` : `${mbps}M`;
}

export function timeAgo(date, now = Date.now()) {
  if (!date) return 'never';
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function clockTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const SEVERITY_RANK = { critical: 4, major: 3, minor: 2, warning: 1 };

export const SEVERITY_STYLE = {
  critical: { text: 'text-down', bar: 'bg-down', label: 'Critical' },
  major: { text: 'text-warn', bar: 'bg-warn', label: 'Major' },
  minor: { text: 'text-muted', bar: 'bg-muted', label: 'Minor' },
  warning: { text: 'text-muted', bar: 'bg-line', label: 'Warning' },
};
