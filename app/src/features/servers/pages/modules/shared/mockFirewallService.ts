import type { FirewallRule } from "@/types/firewall.types";

// In-memory store for development
let inMemoryRules: FirewallRule[] = [
    { id: '1', priority: 1, direction: 'INBOUND', protocol: 'TCP', port: '22', source: 'Any', action: 'ALLOW', enabled: true, note: 'SSH Access' },
    { id: '2', priority: 2, direction: 'INBOUND', protocol: 'TCP', port: '80', source: 'Any', action: 'ALLOW', enabled: true, note: 'HTTP Traffic' },
    { id: '3', priority: 3, direction: 'INBOUND', protocol: 'TCP', port: '443', source: 'Any', action: 'ALLOW', enabled: true, note: 'HTTPS Traffic' },
    { id: '4', priority: 100, direction: 'INBOUND', protocol: 'ANY', port: 'Any', source: 'Any', action: 'DENY', enabled: true, note: 'Default Deny Inbound' },
];

export const mockFirewallService = {
    getRules: async (): Promise<FirewallRule[]> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve([...inMemoryRules]), 300);
        });
    },

    getRule: async (id: string): Promise<FirewallRule | undefined> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve(inMemoryRules.find(r => r.id === id)), 200);
        });
    },

    saveRule: async (rule: Partial<FirewallRule>): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (rule.id) {
                    // Update
                    inMemoryRules = inMemoryRules.map(r => r.id === rule.id ? { ...r, ...rule } as FirewallRule : r);
                } else {
                    // Create
                    const newRule: FirewallRule = {
                        ...rule,
                        id: Math.random().toString(36).substring(7),
                        priority: inMemoryRules.length + 1,
                        enabled: true
                    } as FirewallRule;
                    inMemoryRules.push(newRule);
                }
                resolve();
            }, 500);
        });
    },

    updateRulesOrder: async (rules: FirewallRule[]): Promise<void> => {
        return new Promise(resolve => {
            setTimeout(() => {
                inMemoryRules = rules;
                resolve();
            }, 500);
        });
    },

    deleteRule: async (id: string): Promise<void> => {
        return new Promise(resolve => {
            setTimeout(() => {
                inMemoryRules = inMemoryRules.filter(r => r.id !== id);
                resolve();
            }, 400);
        });
    },

    // New Test Feature
    testRuleConnectivity: async (rule: Partial<FirewallRule>): Promise<{ success: boolean; logs: string[] }> => {
        return new Promise(resolve => {
            const logs: string[] = [];
            const isAllow = rule.action === 'ALLOW';
            const protocol = rule.protocol || 'TCP';

            logs.push(`> Starting connectivity test for ${protocol} port ${rule.port || 'ALL'}...`);
            logs.push(`> Resolving local server address... OK (127.0.0.1)`);

            setTimeout(() => {
                if (protocol === 'ICMP') {
                    logs.push(`> PING 127.0.0.1 (127.0.0.1): 56 data bytes`);
                    if (isAllow) {
                        logs.push(`> 64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.045 ms`);
                        logs.push(`> 64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.038 ms`);
                        logs.push(`> --- 127.0.0.1 ping statistics ---`);
                        logs.push(`> 2 packets transmitted, 2 packets received, 0.0% packet loss`);
                    } else {
                        logs.push(`> Request timeout for icmp_seq 0`);
                        logs.push(`> Request timeout for icmp_seq 1`);
                        logs.push(`> --- 127.0.0.1 ping statistics ---`);
                        logs.push(`> 2 packets transmitted, 0 packets received, 100.0% packet loss`);
                    }
                } else {
                    // TCP/UDP
                    logs.push(`> Connecting to 127.0.0.1:${rule.port || 'random'}...`);
                    if (isAllow) {
                        logs.push(`> Connection established.`);
                        logs.push(`> Sending handshake... OK`);
                        logs.push(`> Received acknowledgment.`);
                        logs.push(`> Connection closed by foreign host.`);
                    } else {
                        logs.push(`> Connect to 127.0.0.1 port ${rule.port || 80}: Connection refused`);
                        logs.push(`> Failed to establish connection.`);
                    }
                }

                resolve({ success: isAllow, logs });
            }, 1500);
        });
    }
};
