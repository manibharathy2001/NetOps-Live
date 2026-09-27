import { useEffect, useState } from 'react';

const WIDTH = 72;
const HEIGHT = 22;
const KEEP = 24;

/*
 * Keeps its own short history of whatever value it is given, so the live
 * metric stream turns into a trend line with no extra state anywhere else.
 */
export default function Sparkline({ value, max = 100, className = '', label }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (value === undefined || value === null) return;
    setHistory((h) => (h[h.length - 1] === value && h.length > 1 ? h : [...h, value].slice(-KEEP)));
  }, [value]);

  if (history.length < 3) {
    return <span className="inline-block h-[22px] w-[72px] align-middle" aria-hidden="true" />;
  }

  const points = history
    .map((v, i) => {
      const x = (i / (history.length - 1)) * WIDTH;
      const y = HEIGHT - 2 - (Math.min(v, max) / max) * (HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const [lastX, lastY] = points.split(' ').pop().split(',');

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`align-middle ${className}`}
      role="img"
      aria-label={label || 'Recent trend'}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={lastX} cy={lastY} r="1.8" fill="currentColor" />
    </svg>
  );
}
