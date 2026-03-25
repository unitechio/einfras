import {
  clearSession,
  getStoredSession,
  saveSession,
  type AuthOrganization,
  type AuthPrincipal,
  type AuthSession,
  type AuthUser,
} from "./auth-session";

const BASE = "/api/v1/auth";

interface RawAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  user?: AuthUser;
  organizations?: AuthOrganization[];
  principal?: AuthPrincipal;
  requires_mfa?: boolean;
  mfa_token?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  organization_id: string;
}

export interface LoginResult {
  session?: AuthSession;
  requiresMFA: boolean;
  mfaToken?: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!res.ok) {
    const message =
      (payload?.error as { message?: string } | undefined)?.message ??
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  return payload as T;
}

async function get<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const message =
      ((payload as Record<string, unknown> | null)?.error as
        | { message?: string }
        | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function toSession(raw: RawAuthResponse): AuthSession {
  if (
    !raw.access_token ||
    !raw.refresh_token ||
    !raw.expires_at ||
    !raw.user ||
    !raw.principal
  ) {
    throw new Error("Incomplete auth response");
  }
  const session: AuthSession = {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: raw.expires_at,
    user: raw.user,
    organizations: raw.organizations ?? [],
    principal: raw.principal,
  };
  saveSession(session);
  return session;
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const raw = await post<RawAuthResponse>("/login", payload);
  if (raw.requires_mfa) {
    return {
      requiresMFA: true,
      mfaToken: raw.mfa_token,
    };
  }
  return {
    requiresMFA: false,
    session: toSession(raw),
  };
}

export async function loginWithTOTP(
  mfaToken: string,
  code: string,
): Promise<AuthSession> {
  const raw = await post<RawAuthResponse>("/login/totp", {
    mfa_token: mfaToken,
    code,
  });
  return toSession(raw);
}

export async function refreshSession(): Promise<AuthSession | null> {
  const current = getStoredSession();
  if (!current?.refreshToken) {
    return null;
  }
  try {
    const raw = await post<RawAuthResponse>("/refresh", {
      refresh_token: current.refreshToken,
    });
    return toSession(raw);
  } catch {
    clearSession();
    return null;
  }
}

export async function fetchMe(token?: string): Promise<RawAuthResponse> {
  const current = getStoredSession();
  return get<RawAuthResponse>("/me", token ?? current?.accessToken);
}

export async function requestPasswordReset(email: string) {
  return post<{ message: string }>("/password/forgot", { email });
}

export async function resetPassword(token: string, newPassword: string) {
  return post<{ message: string }>("/password/reset", {
    token,
    new_password: newPassword,
  });
}

export async function requestMFAReset(email: string) {
  return post<{ message: string }>("/mfa/reset/request", { email });
}

export async function confirmMFAReset(token: string) {
  return post<{ message: string }>("/mfa/reset/confirm", { token });
}

export async function beginMFASetup() {
  const session = getStoredSession();
  if (!session) {
    throw new Error("No active session");
  }
  const res = await fetch(`${BASE}/mfa/setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok) {
    throw new Error(
      ((payload?.error as { message?: string } | undefined)?.message ??
        `HTTP ${res.status}`) as string,
    );
  }
  return payload as {
    setup_token: string;
    secret: string;
    otpauth_url: string;
    recovery_codes: string[];
  };
}

export async function confirmMFASetup(setupToken: string, code: string) {
  const session = getStoredSession();
  if (!session) {
    throw new Error("No active session");
  }
  const res = await fetch(`${BASE}/mfa/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      setup_token: setupToken,
      code,
    }),
  });
  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok) {
    throw new Error(
      ((payload?.error as { message?: string } | undefined)?.message ??
        `HTTP ${res.status}`) as string,
    );
  }
  const me = await fetchMe(session.accessToken);
  if (me.user && me.principal) {
    saveSession({
      ...session,
      user: me.user,
      principal: me.principal,
      organizations: me.organizations ?? session.organizations,
    });
  }
  return payload as { message: string };
}
