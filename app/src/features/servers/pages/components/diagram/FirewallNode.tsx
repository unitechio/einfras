import { Handle, Position } from "reactflow";
import { FaShieldAlt } from "react-icons/fa";

export default function FirewallNode({ data }: any) {
  return (
    <div
      style={{
        border: "2px solid #dc2626",
        borderRadius: 8,
        padding: 10,
        width: 180,
        background: "#fff",
        textAlign: "center",
      }}
    >
      <FaShieldAlt size={28} color="#dc2626" />
      <div style={{ fontWeight: "bold", marginTop: 6 }}>{data.label}</div>
      <div style={{ fontSize: 12 }}>{data.subLabel}</div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
