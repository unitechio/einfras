import { useCallback } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
} from "reactflow";
import type { Connection, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";

// Initial Nodes Setup
const initialNodes: Node[] = [
  // 1. Internet Layer
  {
    id: "internet",
    type: "input",
    data: { label: "Internet (4 x 01 Gbps)" },
    position: { x: 400, y: 0 },
    style: {
      backgroundColor: "#fff",
      border: "2px solid #ccc",
      borderRadius: "50px",
      width: 200,
      height: 80,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontWeight: "bold",
    },
  },
  {
    id: "playback-vms",
    data: { label: "Playback VMS" },
    position: { x: 700, y: 0 },
    style: { backgroundColor: "#fff", border: "1px solid #777" },
  },
  {
    id: "archive-server",
    data: { label: "Archive dữ liệu từ trạm về Server" },
    position: { x: 900, y: 0 },
    style: { backgroundColor: "#fff", border: "1px solid #777" },
  },

  // 2. Firewall Layer
  {
    id: "firewall-external",
    data: { label: "02 Firewall Fortinet External" },
    position: { x: 400, y: 150 },
    style: { backgroundColor: "#fef08a", border: "2px solid #eab308" }, // Yellow/Orange
  },
  {
    id: "waf",
    data: { label: "WAF Web Application Firewall" },
    position: { x: 800, y: 150 },
    style: { backgroundColor: "#ffedd5", border: "2px dashed #f97316" }, // Orange dashed
  },

  // 3. Groups (Subnets/Clusters)
  // Group A: Web Public Internet (No WAF)
  {
    id: "group-b",
    data: { label: "Phân hệ Web Public Internet không qua WAF" },
    position: { x: 50, y: 300 },
    style: {
      width: 600,
      height: 480,
      backgroundColor: "rgba(240, 240, 240, 0.4)",
      border: "2px solid #ccc",
      borderRadius: "10px",
      padding: "10px",
    },
    type: "group",
  },
  // Nodes inside Group A
  {
    id: "node-vms",
    data: { label: "vms.epass-vdtc.com.vn" },
    position: { x: 20, y: 50 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#fff", border: "1px solid #ccc" },
  },
  {
    id: "node-sinvoice",
    data: { label: "sinvoice.epass-vdtc.com.vn" },
    position: { x: 220, y: 50 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#e9d5ff", border: "1px solid #a855f7" }, // Purple
  },
  {
    id: "node-uat",
    data: { label: "UAT 27.71.110.56" },
    position: { x: 420, y: 50 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#fecaca", border: "1px solid #ef4444" }, // Red
  },
  {
    id: "node-backend",
    data: { label: "backend.epass-vdtc.com.vn" },
    position: { x: 20, y: 120 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#fef3c7", border: "1px solid #d97706" }, // Yellow
  },
  {
    id: "node-mycc",
    data: { label: "mycc.epass-vdtc.com.vn" },
    position: { x: 220, y: 120 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#dbeafe", border: "1px solid #2563eb" }, // Blue
  },
  {
    id: "node-callbot",
    data: { label: "callbot/chatbot.epass-vdtc.com.vn" },
    position: { x: 20, y: 200 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#fef3c7", border: "1px solid #d97706" },
  },
  {
    id: "node-ipcc",
    data: { label: "ipcc20/ipcc21.epass-vdtc.com.vn" },
    position: { x: 220, y: 200 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#d1fae5", border: "1px solid #059669" }, // Green
  },
  {
    id: "node-register",
    data: { label: "register-parking/eparking-cms" },
    position: { x: 220, y: 280 },
    parentNode: "group-b",
    extent: "parent",
    style: { backgroundColor: "#e9d5ff", border: "1px solid #a855f7" },
  },

  // Group B: WAF (VCS)
  {
    id: "group-waf",
    data: { label: "Phân hệ WAF (VCS)" },
    position: { x: 700, y: 300 },
    style: {
      width: 500,
      height: 350,
      backgroundColor: "rgba(240, 240, 240, 0.4)",
      border: "2px solid #ccc",
      borderRadius: "10px",
    },
    type: "group",
  },
  // Nodes inside Group B
  {
    id: "node-crm",
    data: { label: "crm.epass-vdtc.com.vn" },
    position: { x: 20, y: 50 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#fff", border: "1px solid #ccc" },
  },
  {
    id: "node-bot",
    data: { label: "bot.epass-vdtc.com.vn" },
    position: { x: 180, y: 50 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#fef3c7", border: "1px solid #d97706" },
  },
  {
    id: "node-audit",
    data: { label: "audit.epass-vdtc.com.vn" },
    position: { x: 340, y: 50 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#fff", border: "1px solid #ccc" },
  },
  {
    id: "node-login",
    data: { label: "login.epass-vdtc.com.vn" },
    position: { x: 20, y: 120 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#fef3c7", border: "1px solid #d97706" },
  },
  {
    id: "node-giaothong",
    data: { label: "giaothongso.com.vn" },
    position: { x: 180, y: 120 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#d1fae5", border: "1px solid #059669" },
  },
  {
    id: "node-customer",
    data: { label: "customer.epass-vdtc.com.vn" },
    position: { x: 340, y: 120 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#fecaca", border: "1px solid #ef4444" },
  },
  {
    id: "node-mot",
    data: { label: "mot.epass-vdtc.com.vn" },
    position: { x: 180, y: 190 },
    parentNode: "group-waf",
    extent: "parent",
    style: { backgroundColor: "#dbeafe", border: "1px solid #2563eb" },
  },

  // 4. Load Balancers
  {
    id: "lb-1",
    data: { label: "Load Balancer" },
    position: { x: 300, y: 850 },
    style: {
      backgroundColor: "#0ea5e9", // Sky blue
      color: "white",
      borderRadius: "50%",
      width: 80,
      height: 80,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      fontSize: "12px",
    },
  },
  {
    id: "lb-2",
    data: { label: "Load Balancer" },
    position: { x: 900, y: 850 },
    style: {
      backgroundColor: "#0ea5e9",
      color: "white",
      borderRadius: "50%",
      width: 80,
      height: 80,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      fontSize: "12px",
    },
  },
  {
    id: "lb-3",
    data: { label: "10.254.247.6" },
    position: { x: 1300, y: 850 },
    style: {
      backgroundColor: "#0ea5e9",
      color: "white",
      borderRadius: "50%",
      width: 80,
      height: 80,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      fontSize: "12px",
    },
  },

  // Firewall BCCS
  {
    id: "firewall-bccs",
    data: { label: "Firewall Fortinet BCCS" },
    position: { x: 1200, y: 950 },
    style: { backgroundColor: "#fef08a", border: "2px solid #eab308" },
  },
];

const initialEdges: Edge[] = [
  // Internet connections
  {
    id: "e-internet-firewall",
    source: "internet",
    target: "firewall-external",
    animated: true,
    style: { stroke: "#555" },
  },
  {
    id: "e-internet-playback",
    source: "internet",
    target: "playback-vms",
    style: { stroke: "#555" },
  },
  {
    id: "e-internet-archive",
    source: "internet",
    target: "archive-server",
    style: { stroke: "#555" },
  },
  

  // Firewall to Groups
  {
    id: "e-fw-groupb",
    source: "firewall-external",
    target: "group-b",
    type: "smoothstep",
  },
  {
    id: "e-fw-waf",
    source: "firewall-external",
    target: "waf",
    type: "smoothstep",
  },

  // WAF to Group WAF
  {
    id: "e-waf-groupwaf",
    source: "waf",
    target: "group-waf",
    type: "smoothstep",
    animated: true,
  },
];

export default function InfraDiagram() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      >
        <Background color="#aaa" gap={16} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "group") return "blue";
            return "#ccc";
          }}
        />
        <Controls />
        <Panel position="top-right">
          <div className="bg-white p-2 rounded shadow text-xs">
            <h3 className="font-bold mb-1">Legend</h3>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-purple-200 border border-purple-500"></div>{" "}
              Service A
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-red-200 border border-red-500"></div>{" "}
              Critical
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-500"></div>{" "}
              Warning
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
