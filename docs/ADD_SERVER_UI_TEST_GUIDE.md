# Add Server UI Test Guide

## Route

- Open `http://localhost:5173/servers/add`

## What This UI Now Does

- Creates the server record through `POST /api/v1/servers`
- If `Connection Strategy = Agent`:
  - issues token through `POST /api/v1/servers/{id}/agent-token`
  - fetches install script through `POST /api/v1/servers/{id}/agent/install-script`
  - polls `GET /api/v1/servers/{id}/agent-status`

## Recommended Test Case

### 1. Basic

- Display Name: `ui-agent-node-01`
- Hostname: `ui-agent-node-01`
- IP / FQDN: `127.0.0.1`
- Environment: `Production`
- Operating System:
  - `Linux` if testing local agent script style
  - `Windows` only if your agent target is Windows
- Tags: `ui-test, agent`

### 2. Connection

- Connection Strategy: `Agent`
- Port:
  - `22` for Linux
  - `5985` for Windows
- Login User:
  - `root` for Linux
  - `Administrator` for Windows

### 3. Authentication

- Leave as automatic agent onboarding
- UI will request the token from backend after create

### 4. Privileges

- Linux:
  - Login User: `root`
  - Sudo Strategy: `sudo`
- Windows:
  - `Administrator`

### 5. Create

- Click `Create Server`
- Expected result:
  - success panel appears
  - `Server ID` shown
  - `Agent Token` shown
  - `Install Script` shown

## Direct / SSH Test Case

Use this only if you want to register a non-agent node first.

- Connection Strategy: `Direct`
- Authentication:
  - `Password`, then fill password
  - or `SSH Key Path`, then provide a real path already available to backend runtime

Expected result:

- server record is created
- no agent token/install script section
- node appears in server list

## Current Supported Rules

- `Agent` mode is the recommended and most complete path
- `SSH Key` UI stores `ssh_key_path`, not raw private key content
- `Bastion` currently stores bastion host only as UI input for operator flow; backend resource path is still centered on server record + agent operations

## Verification Checklist

- Use a unique `IP / FQDN` for each new server record. Backend rejects duplicate IPs.
- New node appears in `/servers`
- Open created node and confirm overview loads
- For agent mode:
  - run the install script on the target machine
  - refresh until `Agent Status` becomes `online`
- Check backend logs:
  - `logs/api-YYYY-MM-DD.log`

## Known Limits

- Search on server list is currently client-side after list fetch
- Bastion is not yet a fully separate backend resource model
- Vault/file-upload credential UX is not wired into backend secret storage yet; the stable backend path today is `password` or `ssh_key_path`
