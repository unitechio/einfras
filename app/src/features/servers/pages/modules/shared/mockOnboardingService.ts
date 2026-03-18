
// ─── Server Onboarding State Machine ─────────────────────────────────────────
// Simulates the backend async workflow for server onboarding.
// In production: powered by goroutines/queue + WebSocket streaming.

export type ServerOnboardingStatus =
  | 'PENDING'
  | 'CONNECTING'
  | 'AGENT_INSTALLING'
  | 'VERIFYING'
  | 'SYNCING'
  | 'ACTIVE'
  | 'FAILED';

export type OnboardingStepId =
  | 'connection_test'
  | 'agent_install'
  | 'verify'
  | 'sync_resources'
  | 'complete';

export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  description: string;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface OnboardingLogEntry {
  ts: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'cmd';
  message: string;
}

export interface OnboardingSession {
  id: string;
  serverName: string;
  serverIp: string;
  os: 'linux' | 'windows';
  mode: string;
  overallStatus: ServerOnboardingStatus;
  steps: OnboardingStep[];
  logs: OnboardingLogEntry[];
  sysInfo?: DetectedSystemInfo;
  startedAt: number;
  completedAt?: number;
}

export interface DetectedSystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  arch: string;
  cpu: string;
  cpuCores: number;
  ramGb: number;
  diskGb: number;
  hasDocker: boolean;
  dockerVersion?: string;
  hasKubernetes: boolean;
  k8sVersion?: string;
  agentVersion: string;
}

export interface OnboardingConfig {
  serverName: string;
  ip: string;
  port: string;
  os: 'linux' | 'windows';
  mode: 'agent' | 'direct' | 'bastion';
  authMethod: string;
  bastionHost?: string;
  sshUser?: string;
}

// ─── Initial Steps Template ───────────────────────────────────────────────────

const buildInitialSteps = (os: 'linux' | 'windows'): OnboardingStep[] => [
  {
    id: 'connection_test',
    label: 'Test Connectivity',
    description: 'Verify network reach + SSH/WinRM handshake',
    status: 'pending',
  },
  {
    id: 'agent_install',
    label: 'Install Agent',
    description: os === 'linux'
      ? 'Deploy EINFRA agent via SSH bootstrap script'
      : 'Deploy EINFRA agent via WinRM PowerShell',
    status: 'pending',
  },
  {
    id: 'verify',
    label: 'Verify Heartbeat',
    description: 'Confirm agent is alive and reporting back',
    status: 'pending',
  },
  {
    id: 'sync_resources',
    label: 'Sync Resources',
    description: 'Collect system info, detect Docker & Kubernetes',
    status: 'pending',
  },
  {
    id: 'complete',
    label: 'Node Ready',
    description: 'Server registered and active in cluster',
    status: 'pending',
  },
];

// ─── Log factories ────────────────────────────────────────────────────────────

const log = (level: OnboardingLogEntry['level'], message: string): OnboardingLogEntry => ({
  ts: Date.now(),
  level,
  message,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Mock Onboarding Service ──────────────────────────────────────────────────

class OnboardingService {
  private sessions = new Map<string, OnboardingSession>();

  createSession(config: OnboardingConfig): OnboardingSession {
    const id = `session_${Date.now()}`;
    const session: OnboardingSession = {
      id,
      serverName: config.serverName,
      serverIp: config.ip,
      os: config.os,
      mode: config.mode,
      overallStatus: 'PENDING',
      steps: buildInitialSteps(config.os),
      logs: [],
      startedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): OnboardingSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Kick off the full async onboarding pipeline.
   * Calls `onUpdate` on every state change so the UI updates in real-time.
   */
  async startOnboarding(
    sessionId: string,
    onUpdate: (session: OnboardingSession) => void,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const push = (entry: OnboardingLogEntry) => {
      session.logs = [...session.logs, entry];
      onUpdate({ ...session });
    };

    const setStep = (id: OnboardingStepId, status: StepStatus, errorMessage?: string) => {
      session.steps = session.steps.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              ...(status === 'running' ? { startedAt: Date.now() } : {}),
              ...(status === 'success' || status === 'error' ? { completedAt: Date.now() } : {}),
              ...(errorMessage ? { errorMessage } : {}),
            }
          : s,
      );
      onUpdate({ ...session });
    };

    // ── Step 1: Connection Test ─────────────────────────────────────────────
    session.overallStatus = 'CONNECTING';
    setStep('connection_test', 'running');
    push(log('info', `Initiating TCP connection to ${session.serverIp}:22 ...`));
    await delay(700);
    push(log('cmd', `nc -zv ${session.serverIp} 22`));
    await delay(800);
    push(log('info', 'TCP port open — handshake accepted'));
    await delay(400);
    push(log('cmd', `ssh -o ConnectTimeout=10 root@${session.serverIp} 'echo OK'`));
    await delay(900);
    push(log('success', 'SSH authentication successful ✓'));
    await delay(300);
    push(log('info', 'Checking sudo privileges ...'));
    await delay(500);
    push(log('success', 'Sudo access confirmed (NOPASSWD) ✓'));
    setStep('connection_test', 'success');

    // ── Step 2: Agent Install ───────────────────────────────────────────────
    session.overallStatus = 'AGENT_INSTALLING';
    setStep('agent_install', 'running');
    const installScript =
      session.os === 'linux'
        ? 'curl -sSL https://get.einfra.io/agent | sudo bash -s -- --token $TOKEN'
        : 'iex ((New-Object System.Net.WebClient).DownloadString("https://get.einfra.io/agent.ps1"))';
    push(log('info', 'Uploading bootstrap installer...'));
    await delay(600);
    push(log('cmd', `scp /tmp/einfra-bootstrap.sh root@${session.serverIp}:/tmp/`));
    await delay(700);
    push(log('info', 'Running bootstrap installer on remote...'));
    await delay(300);
    push(log('cmd', installScript));
    await delay(1200);
    push(log('info', '[remote] Detecting package manager: apt'));
    await delay(400);
    push(log('info', '[remote] Updating package index...'));
    await delay(900);
    push(log('cmd', '[remote] apt-get install -y einfra-agent=2.4.1'));
    await delay(1100);
    push(log('info', '[remote] Enabling einfra-agent.service'));
    await delay(500);
    push(log('cmd', '[remote] systemctl enable --now einfra-agent'));
    await delay(600);
    push(log('success', 'Agent v2.4.1 installed and started ✓'));
    setStep('agent_install', 'success');

    // ── Step 3: Verify Heartbeat ────────────────────────────────────────────
    session.overallStatus = 'VERIFYING';
    setStep('verify', 'running');
    push(log('info', 'Waiting for agent heartbeat on control plane...'));
    await delay(800);
    push(log('info', 'Polling /v1/agents/heartbeat ...'));
    await delay(700);
    push(log('info', 'Heartbeat received (latency: 12ms)'));
    await delay(400);
    push(log('info', 'Verifying agent token signature ...'));
    await delay(500);
    push(log('success', 'Heartbeat verified — agent is reporting ✓'));
    setStep('verify', 'success');

    // ── Step 4: Sync Resources ──────────────────────────────────────────────
    session.overallStatus = 'SYNCING';
    setStep('sync_resources', 'running');
    push(log('info', 'Collecting system information...'));
    await delay(500);
    push(log('cmd', '[agent] uname -a'));
    await delay(400);
    push(log('info', '[agent] Linux prod-db-01 5.15.0-107-generic #117-Ubuntu SMP'));
    await delay(300);
    push(log('cmd', '[agent] lscpu | grep -E "Model|CPU\\(s\\)"'));
    await delay(500);
    push(log('info', '[agent] CPU: Intel(R) Xeon(R) Gold 6226R CPU @ 2.90GHz — 16 cores'));
    await delay(400);
    push(log('cmd', '[agent] free -g'));
    await delay(400);
    push(log('info', '[agent] Memory: 64 GB total, 41 GB available'));
    await delay(400);
    push(log('cmd', '[agent] df -h /'));
    await delay(400);
    push(log('info', '[agent] Disk: 400 GB total, 128 GB used'));
    await delay(300);
    push(log('info', 'Detecting container runtimes...'));
    await delay(600);
    push(log('cmd', '[agent] docker version --format json'));
    await delay(700);
    push(log('success', '[agent] Docker Engine v24.0.7 detected ✓'));
    await delay(300);
    push(log('cmd', '[agent] kubectl version --client --short 2>/dev/null'));
    await delay(700);
    push(log('warn', '[agent] kubectl not found — Kubernetes not detected'));
    await delay(400);
    push(log('info', 'Registering node into cluster inventory...'));
    await delay(600);
    push(log('success', 'Resource sync complete ✓'));
    setStep('sync_resources', 'success');

    // ── Step 5: Complete ────────────────────────────────────────────────────
    setStep('complete', 'running');
    await delay(400);
    push(log('info', 'Writing node registration to database...'));
    await delay(500);
    push(log('success', `Node "${session.serverName}" (${session.serverIp}) is now ACTIVE ✓`));
    setStep('complete', 'success');

    session.overallStatus = 'ACTIVE';
    session.completedAt = Date.now();
    session.sysInfo = {
      hostname: session.serverName,
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-107-generic',
      arch: 'x86_64',
      cpu: 'Intel Xeon Gold 6226R @ 2.90GHz',
      cpuCores: 16,
      ramGb: 64,
      diskGb: 400,
      hasDocker: true,
      dockerVersion: 'v24.0.7',
      hasKubernetes: false,
      agentVersion: '2.4.1',
    };
    onUpdate({ ...session });
  }

  async retryFromStep(
    sessionId: string,
    fromStepId: OnboardingStepId,
    onUpdate: (session: OnboardingSession) => void,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Reset steps from the failed step onward
    let found = false;
    session.steps = session.steps.map((s) => {
      if (s.id === fromStepId) found = true;
      return found ? { ...s, status: 'pending', errorMessage: undefined } : s;
    });
    session.overallStatus = 'CONNECTING';
    session.logs = [
      ...session.logs,
      log('warn', '─── Retrying from: ' + fromStepId.replace('_', ' ').toUpperCase() + ' ───'),
    ];
    onUpdate({ ...session });

    await this.startOnboarding(sessionId, onUpdate);
  }
}

export const mockOnboardingService = new OnboardingService();
