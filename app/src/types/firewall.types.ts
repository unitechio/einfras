export type FirewallAction = 'ALLOW' | 'DENY' | 'REJECT';
export type FirewallDirection = 'INBOUND' | 'OUTBOUND';
export type FirewallProtocol = 'TCP' | 'UDP' | 'ICMP' | 'ANY';

export interface FirewallRule {
    id: string;
    priority: number;
    direction: FirewallDirection;
    protocol: FirewallProtocol;
    port: string; // "22", "80-443", "80,443", "*"
    source: string; // "Any", "192.168.1.0/24", "1.2.3.4"
    action: FirewallAction;
    enabled: boolean;
    note?: string;
}

export interface FirewallPolicy {
    defaultInbound: 'ALLOW' | 'DENY';
    defaultOutbound: 'ALLOW' | 'DENY';
}

export interface FirewallStats {
    totalRules: number;
    activeRules: number;
    lastUpdated: string;
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
}
