export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  totp_enabled?: boolean;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AuthPrincipal {
  user_id: string;
  organization_id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  teams: string[];
  expires_at?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
  organizations: AuthOrganization[];
  principal: AuthPrincipal;
}

const STORAGE_KEY = "einfra_auth_session";

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
