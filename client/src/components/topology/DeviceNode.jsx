import { memo, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import StatusBadge, { STATUS } from '../StatusBadge.jsx';

const handleStyle = { background: 'transparent', border: 'none', width: 1, height: 1 };

function DeviceNode({ data }) {
  const { device, alarmCount, changedAt, isSelected } = data;
  const ref = useRef(null);
  const s = STATUS[device.status] || STATUS.UP;

  // Same live-change flash as the dashboard rows.
  useEffect(() => {
    if (!changedAt || !ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ref.current.animate(
      [{ boxShadow: `0 0 0 8px ${s.flash}` }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 1800, easing: 'ease-out' }
    );
  }, [changedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className={`w-[190px] rounded-md border border-l-4 border-line bg-panel px-3 py-2 shadow-sm ${s.stripe} ${
        isSelected ? 'outline-2 outline-offset-2 outline-action' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} isConnectable={false} />
      <p className="font-mono text-sm font-medium">{device.hostname}</p>
      <p className="text-xs text-muted">{device.platform}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <StatusBadge status={device.status} />
        {device.status !== 'DOWN' && (
          <span className={`text-xs tabular-nums ${device.cpu >= 85 ? 'text-down' : 'text-muted'}`}>
            CPU {device.cpu}%
          </span>
        )}
      </div>
      {alarmCount > 0 && (
        <p className="mt-1 text-xs font-medium text-down">
          {alarmCount} active {alarmCount === 1 ? 'alarm' : 'alarms'}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={handleStyle} isConnectable={false} />
    </div>
  );
}

export default memo(DeviceNode);
