export type ServerStatus = "running" | "warning" | "critical";

export interface ServerData {
  label: string;
  status: ServerStatus;
}
