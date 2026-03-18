export { ServersPage } from './pages/ServersPage';
export { default as InfraDiagram } from './pages/InfraDiagram';

// Agent-based architecture — Phase 1
export { AgentTerminal } from './components/AgentTerminal';
export { AgentStatusBadge, AgentMetricsBar } from './components/AgentStatusBadge';
export { useAgentSocket } from './hooks/useAgentSocket';
export type { CommandState, CommandStatus, AgentMetrics, AgentConnectionState } from './hooks/useAgentSocket';
