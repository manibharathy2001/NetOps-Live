import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

function ActionButton({ children, onClick, busy, disabled, tone = 'default' }) {
  const tones = {
    default: 'border-line bg-panel text-ink hover:bg-canvas',
    danger: 'border-down/40 bg-panel text-down hover:bg-down/5',
    primary: 'border-action bg-action text-white hover:bg-action/90',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? 'Sending…' : children}
    </button>
  );
}

export default function SimulatorPanel({ devices }) {
  const [hostname, setHostname] = useState('');
  const [ifName, setIfName] = useState('');
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);

  const device = devices.find((d) => d.hostname === hostname);

  // Pick a sensible default device once the list arrives.
  useEffect(() => {
    if (!hostname && devices.length) {
      setHostname(devices.find((d) => d.hostname === 'NCS-540-03')?.hostname || devices[0].hostname);
    }
  }, [devices, hostname]);

  // Reset the interface choice when the device changes.
  useEffect(() => {
    setIfName(device?.interfaces[0]?.name || '');
  }, [hostname]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key, label, path, body) {
    setBusy(key);
    setResult(null);
    try {
      await api(`/api/simulator/${path}`, { method: 'POST', body });
      setResult({ ok: true, text: `${label}: sent` });
    } catch (err) {
      setResult({ ok: false, text: `${label}: ${err.message}` });
    } finally {
      setBusy(null);
    }
  }

  const iface = device?.interfaces.find((i) => i.name === ifName);
  const isDown = device?.status === 'DOWN';

  return (
    <section aria-labelledby="sim-heading" className="rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="sim-heading" className="font-semibold">Event simulator</h2>
        <p className="text-sm text-muted">Trigger network events. Every open dashboard sees them instantly.</p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Device</span>
          <select
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-sm"
          >
            {devices.map((d) => (
              <option key={d.hostname} value={d.hostname}>{d.hostname}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="danger"
            busy={busy === 'down'}
            disabled={!device || isDown}
            onClick={() => run('down', 'Take device down', 'device-down', { hostname })}
          >
            Take device down
          </ActionButton>
          <ActionButton
            busy={busy === 'up'}
            disabled={!device || !isDown}
            onClick={() => run('up', 'Bring device up', 'device-up', { hostname })}
          >
            Bring device up
          </ActionButton>
          <ActionButton
            busy={busy === 'cpu'}
            disabled={!device || isDown}
            onClick={() => run('cpu', 'Spike CPU', 'high-cpu', { hostname, cpu: 95, durationSec: 30 })}
          >
            Spike CPU for 30s
          </ActionButton>
        </div>

        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Interface</span>
            <select
              value={ifName}
              onChange={(e) => setIfName(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-sm"
            >
              {device?.interfaces.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.name} ({i.operStatus})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton
              tone="danger"
              busy={busy === 'ifdown'}
              disabled={!iface || iface.operStatus === 'down'}
              onClick={() => run('ifdown', 'Shut interface', 'interface-down', { hostname, interface: ifName })}
            >
              Shut interface
            </ActionButton>
            <ActionButton
              busy={busy === 'ifup'}
              disabled={!iface || iface.operStatus === 'up'}
              onClick={() => run('ifup', 'Restore interface', 'interface-up', { hostname, interface: ifName })}
            >
              Restore interface
            </ActionButton>
          </div>
        </div>

        <div className="rounded-md bg-canvas px-3 py-3">
          <p className="text-sm">
            <span className="font-medium">Fiber cut</span>
            <span className="text-muted">
              {' '}takes the uplink down, then ISIS, then BGP, over a few seconds, and opens an incident.
            </span>
          </p>
          <div className="mt-2">
            <ActionButton
              tone="danger"
              busy={busy === 'fiber'}
              disabled={!device}
              onClick={() => run('fiber', 'Fiber cut', 'scenario/fiber-cut', { hostname })}
            >
              Cut fiber on {hostname || 'device'}
            </ActionButton>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted">Clear every alarm and bring all devices back up.</p>
          <ActionButton tone="primary" busy={busy === 'recover'} onClick={() => run('recover', 'Recover network', 'recover', {})}>
            Recover network
          </ActionButton>
        </div>

        <p aria-live="polite" className={`min-h-5 text-sm ${result?.ok === false ? 'text-down' : 'text-muted'}`}>
          {result?.text}
        </p>
      </div>
    </section>
  );
}
