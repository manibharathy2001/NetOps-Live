import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocketEvent } from '../hooks/useSocketEvent.js';

const TOAST_MS = 8000;

// Pops up for every engineer, on any page, when an incident is opened.
export default function IncidentToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t._id !== id)), []);

  useSocketEvent('incident:created', (incident) => {
    setToasts((list) => [...list.filter((t) => t._id !== incident._id), incident].slice(-3));
    setTimeout(() => dismiss(incident._id), TOAST_MS);
  });

  return (
    <div aria-live="assertive" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t._id} className="pointer-events-auto rounded-lg border border-line border-l-4 border-l-down bg-panel px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {t.number} opened on <span className="font-mono">{t.hostname}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted">{t.title}</p>
              <p className="mt-1 text-xs text-muted">
                {t.source === 'auto' ? 'Opened automatically from a critical alarm' : 'Opened by an engineer'}
              </p>
              <Link
                to={`/incidents/${t._id}`}
                onClick={() => dismiss(t._id)}
                className="mt-1.5 inline-block text-sm font-medium text-action hover:underline"
              >
                View incident
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t._id)}
              className="rounded px-1 text-muted hover:text-ink"
              aria-label={`Dismiss ${t.number}`}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
