import { Handle, Position } from "reactflow";
import { FaRandom } from "react-icons/fa";

export default function LoadBalancerNode({ data }: any) {
  return (
    <div
      style={{
        border: "2px solid #2563eb",
        borderRadius: 50,
        padding: 12,
        width: 160,
        background: "#eff6ff",
        textAlign: "center",
      }}
    >
      <FaRandom size={24} color="#2563eb" />
      <div>{data.label}</div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
