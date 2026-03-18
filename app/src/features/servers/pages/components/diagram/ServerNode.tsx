import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import type { ServerData } from "@/types/infra";

const statusColor: Record<string, string> = {
  running: "#16a34a",
  warning: "#f59e0b",
  critical: "#dc2626",
};

export default function ServerNode({ data }: NodeProps<ServerData>) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        minWidth: 140,
        background: "#111827",
        color: "#fff",
        border: `2px solid ${statusColor[data.status]}`,
      }}
    >
      <strong>{data.label}</strong>
      <div style={{ fontSize: 12, marginTop: 6 }}>
        Status:
        <span style={{ color: statusColor[data.status], marginLeft: 6 }}>
          {data.status.toUpperCase()}
        </span>
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
