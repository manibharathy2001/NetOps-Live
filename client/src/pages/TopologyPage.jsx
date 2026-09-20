import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, ReactFlow, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDevices } from '../hooks/useDevices.js';
import { useAlarms } from '../hooks/useAlarms.js';
import { useNow } from '../hooks/useNow.js';
import { buildLinks, defaultPositions, toEdges } from '../lib/topology.js';
import DeviceNode from '../components/topology/DeviceNode.jsx';
import TopologyPanel from '../components/topology/TopologyPanel.jsx';

// Defined outside the component so React Flow doesn't re-create node types each render.
const nodeTypes = { device: DeviceNode };
const STORAGE_KEY = 'netops.topology.positions';

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
      <span className="flex items-center gap-2">
        <svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" stroke="#8494a7" strokeWidth="3" /></svg>
        100G link
      </span>
      <span className="flex items-center gap-2">
        <svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" stroke="#8494a7" strokeWidth="1.75" /></svg>
        10G link
      </span>
      <span className="flex items-center gap-2">
        <svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" stroke="#c53b3b" strokeWidth="2" strokeDasharray="6 4" /></svg>
        Link down
      </span>
    </div>
  );
}

export default function TopologyPage() {
  const { devices, loading, error, changedAt } = useDevices();
  const { alarms } = useAlarms();
  const now = useNow(5000);

  const [selection, setSelection] = useState(null); // { kind: 'device' | 'link', id }
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [flow, setFlow] = useState(null);
  const savedRef = useRef(loadSaved());
  const fittedRef = useRef(false);

  const alarmsByHost = useMemo(() => {
    const map = {};
    for (const a of alarms) (map[a.hostname] ||= []).push(a);
    return map;
  }, [alarms]);

  const defaults = useMemo(() => defaultPositions(devices), [devices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep node positions (and React Flow's measurements) but refresh the data
  // whenever device state changes from a socket event.
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return devices.map((d) => {
        const old = prevById.get(d.hostname);
        return {
          ...(old || {}),
          id: d.hostname,
          type: 'device',
          position: old?.position || savedRef.current[d.hostname] || defaults[d.hostname] || { x: 0, y: 0 },
          data: {
            device: d,
            alarmCount: alarmsByHost[d.hostname]?.length || 0,
            changedAt: changedAt[d.hostname],
            isSelected: selection?.kind === 'device' && selection.id === d.hostname,
          },
        };
      });
    });
  }, [devices, alarmsByHost, changedAt, selection, defaults, setNodes]);

  const links = useMemo(() => buildLinks(devices), [devices]);
  const edges = useMemo(
    () => toEdges(links, selection?.kind === 'link' ? selection.id : null),
    [links, selection]
  );

  // Fit the diagram to the screen once, after the first nodes are measured.
  useEffect(() => {
    if (!flow || fittedRef.current || nodes.length === 0) return undefined;
    const t = setTimeout(() => {
      flow.fitView({ padding: 0.2 });
      fittedRef.current = true;
    }, 60);
    return () => clearTimeout(t);
  }, [flow, nodes.length]);

  const handleDragStop = useCallback((_event, node) => {
    savedRef.current = { ...savedRef.current, [node.id]: node.position };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRef.current));
    } catch {
      // Storage full or blocked: layout just won't be remembered.
    }
  }, []);

  const resetLayout = () => {
    savedRef.current = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setNodes((ns) => ns.map((n) => ({ ...n, position: defaults[n.id] || n.position })));
    setTimeout(() => flow?.fitView({ padding: 0.2, duration: 300 }), 50);
  };

  const downLinks = links.filter((l) => !l.up).length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Topology</h1>
          <p className="mt-1 text-sm text-muted">
            {links.length} links, {downLinks === 0 ? 'all up' : <span className="font-medium text-down">{downLinks} down</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Legend />
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-canvas"
          >
            Reset layout
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-down" role="alert">{error}</p>}

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[calc(100vh-170px)] min-h-[460px] overflow-hidden rounded-lg border border-line bg-canvas">
          {loading && devices.length === 0 ? (
            <p className="p-5 text-sm text-muted">Loading topology…</p>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={handleDragStop}
              onNodeClick={(_e, node) => setSelection({ kind: 'device', id: node.id })}
              onEdgeClick={(_e, edge) => setSelection({ kind: 'link', id: edge.id })}
              onPaneClick={() => setSelection(null)}
              onInit={setFlow}
              nodesConnectable={false}
              minZoom={0.3}
              maxZoom={2}
            >
              <Background gap={24} color="#d5dbe3" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        <TopologyPanel
          devices={devices}
          selection={selection}
          links={links}
          alarmsByHost={alarmsByHost}
          onSelect={setSelection}
          now={now}
        />
      </div>
    </main>
  );
}
