import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { timeAgo } from '../lib/format.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.cfg,.conf';
const ALLOWED_EXT = ACCEPT.split(',');

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// Cloudinary resizes on the fly when the size is written into the URL.
const thumbnail = (url) => url.replace('/image/upload/', '/image/upload/c_fill,w_360,h_220,q_auto,f_auto/');

// fetch() can't report upload progress, so use XMLHttpRequest for uploads.
function uploadWithProgress(url, file, filename, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file, filename);

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error(`Can't reach the server at ${API_URL}.`));
    xhr.send(form);
  });
}

export default function Attachments({ incident, canEdit }) {
  const { session, user } = useAuth();
  const [uploads, setUploads] = useState([]); // in-progress: { id, name, progress }
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState(null);
  const inputRef = useRef(null);

  const start = useCallback(
    async (file, filename = file.name) => {
      const ext = `.${filename.split('.').pop().toLowerCase()}`;
      if (!ALLOWED_EXT.includes(ext)) {
        setMessage(`${filename}: only images, PDFs and txt, log or cfg files can be attached.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setMessage(`${filename} is ${formatBytes(file.size)}. The limit is 10 MB.`);
        return;
      }

      const id = `${Date.now()}-${Math.random()}`;
      setMessage(null);
      setUploads((u) => [...u, { id, name: filename, progress: 0 }]);
      try {
        await uploadWithProgress(
          `${API_URL}/api/incidents/${incident._id}/attachments`,
          file,
          filename,
          session.token,
          (progress) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x)))
        );
        // No need to add it here: incident:updated arrives over the socket for everyone, including us.
      } catch (err) {
        setMessage(`${filename}: ${err.message}`);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    },
    [incident._id, session.token]
  );

  const handleFiles = (fileList) => [...fileList].forEach((f) => start(f));

  // Paste a screenshot anywhere on the incident page (Ctrl + V).
  // Text pastes are left alone, so the comment box still works normally.
  useEffect(() => {
    if (!canEdit) return undefined;
    const onPaste = (e) => {
      const images = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;
      e.preventDefault();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      images.forEach((f, i) => {
        const ext = f.type.split('/')[1].replace('jpeg', 'jpg');
        start(f, `screenshot-${stamp}${i ? `-${i}` : ''}.${ext}`);
      });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [canEdit, start]);

  async function remove(att) {
    if (!window.confirm(`Remove ${att.filename} from ${incident.number}?`)) return;
    try {
      await api(`/api/incidents/${incident._id}/attachments/${att._id}`, { method: 'DELETE' });
    } catch (err) {
      setMessage(err.message);
    }
  }

  const canRemove = (att) => canEdit && (user.role === 'admin' || att.uploadedById === user.id);
  const images = incident.attachments.filter((a) => (a.resourceType || 'image') === 'image');
  const files = incident.attachments.filter((a) => a.resourceType === 'raw');
  const now = Date.now();

  return (
    <div className="space-y-4">
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-md border-2 border-dashed px-4 py-5 text-center text-sm ${
            dragging ? 'border-action bg-action/5' : 'border-line'
          }`}
        >
          <p>
            Drop a screenshot or command output here, or{' '}
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-action hover:underline">
              choose a file
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-muted">
            You can also paste a screenshot with Ctrl + V. Images, PDF, txt, log and cfg files up to 10 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {uploads.map((u) => (
        <div key={u.id} className="text-sm">
          <div className="flex justify-between">
            <span className="truncate">{u.name}</span>
            <span className="tabular-nums text-muted">{u.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
            <div className="h-full bg-action transition-[width]" style={{ width: `${u.progress}%` }} />
          </div>
        </div>
      ))}

      {message && <p className="text-sm text-down" role="alert">{message}</p>}

      {incident.attachments.length === 0 && uploads.length === 0 && (
        <p className="text-sm text-muted">No attachments yet.</p>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((a) => (
            <li key={a._id} className="min-w-0">
              <a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line bg-canvas">
                <img src={thumbnail(a.url)} alt={a.filename} loading="lazy" className="aspect-[36/22] w-full object-cover" />
              </a>
              <p className="mt-1 truncate text-sm" title={a.filename}>{a.filename}</p>
              <p className="text-xs text-muted">
                {a.uploadedBy}, {timeAgo(a.uploadedAt, now)}
                {canRemove(a) && (
                  <button type="button" onClick={() => remove(a)} className="ml-2 font-medium text-down hover:underline">
                    Remove
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {files.map((a) => (
            <li key={a._id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <a href={a.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-sm text-action hover:underline">
                  {a.filename}
                </a>
                <p className="text-xs text-muted">
                  {formatBytes(a.bytes)}, {a.uploadedBy}, {timeAgo(a.uploadedAt, now)}
                </p>
              </div>
              {canRemove(a) && (
                <button type="button" onClick={() => remove(a)} className="shrink-0 text-sm font-medium text-down hover:underline">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
