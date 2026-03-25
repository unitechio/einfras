import { QueryClient } from "@tanstack/react-query";
import { clearSession, getStoredSession } from "@/features/authentication/auth-session";
import { refreshSession } from "@/features/authentication/api";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return apiFetchWithRetry<T>(endpoint, options, true);
}

export async function apiFetchBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    return apiFetchBlobWithRetry(endpoint, options, true);
}

export function buildApiWebSocketUrl(endpoint: string): string {
    const current = new URL(window.location.href);
    const configuredBase = import.meta.env.VITE_API_BASE_URL || "/api";
    const devBackendPort = import.meta.env.VITE_API_DEV_PORT || "8080";
    const base = !String(import.meta.env.VITE_API_BASE_URL || "").trim() && import.meta.env.DEV
        ? new URL(`${current.protocol}//${current.hostname}:${devBackendPort}`)
        : resolveApiBaseUrl();
    const session = getStoredSession();
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    if (configuredBase.startsWith("http") && !import.meta.env.DEV) {
        // keep configured absolute API host in production-like setups
    }
    applyEndpoint(base, endpoint);
    if (session?.accessToken) {
        base.searchParams.set("access_token", session.accessToken);
    }
    return base.toString();
}

export function buildApiUrl(endpoint: string): string {
    const base = resolveApiBaseUrl();
    applyEndpoint(base, endpoint);
    return base.toString();
}

export function buildAuthHeaders(headers: HeadersInit = {}): HeadersInit {
    const session = getStoredSession();
    return {
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(session?.principal?.organization_id ? { "X-Organization-ID": session.principal.organization_id } : {}),
        ...headers,
    };
}

export async function downloadApiFile(endpoint: string, fileName?: string): Promise<void> {
    const blob = await apiFetchBlob(endpoint, { method: "GET" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    if (fileName) {
        link.download = fileName;
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function apiFetchWithRetry<T>(endpoint: string, options: RequestInit = {}, allowRefresh: boolean): Promise<T> {
    const url = buildApiUrl(endpoint);
    const session = getStoredSession();
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const requestHeaders = {
        Accept: "application/json",
        ...buildAuthHeaders(options.headers),
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
    };

    let response = await fetch(url, {
        ...options,
        headers: requestHeaders,
    });

    if (response.status === 404 && shouldRetryWithoutApiPrefix(url, endpoint)) {
        response = await fetch(buildFallbackApiUrl(endpoint), {
            ...options,
            headers: requestHeaders,
        });
    }

    if (response.status === 401 && allowRefresh && session?.refreshToken) {
        const refreshed = await refreshSession();
        if (refreshed) {
            return apiFetchWithRetry<T>(endpoint, options, false);
        }
        clearSession();
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
            errorData?.error?.message ||
            errorData?.message ||
            `API Error: ${response.status}`;
        throw new Error(message);
    }

    return response.json();
}

async function apiFetchBlobWithRetry(endpoint: string, options: RequestInit = {}, allowRefresh: boolean): Promise<Blob> {
    const url = buildApiUrl(endpoint);
    const session = getStoredSession();

    let response = await fetch(url, {
        ...options,
        headers: {
            Accept: "*/*",
            ...buildAuthHeaders(options.headers),
        },
    });

    if (response.status === 404 && shouldRetryWithoutApiPrefix(url, endpoint)) {
        response = await fetch(buildFallbackApiUrl(endpoint), {
            ...options,
            headers: {
                Accept: "*/*",
                ...buildAuthHeaders(options.headers),
            },
        });
    }

    if (response.status === 401 && allowRefresh && session?.refreshToken) {
        const refreshed = await refreshSession();
        if (refreshed) {
            return apiFetchBlobWithRetry(endpoint, options, false);
        }
        clearSession();
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
            errorData?.error?.message ||
            errorData?.message ||
            `API Error: ${response.status}`;
        throw new Error(message);
    }

    return response.blob();
}

function resolveApiBaseUrl(): URL {
    const configuredBase = import.meta.env.VITE_API_BASE_URL || "/api";
    const current = new URL(window.location.href);
    return configuredBase.startsWith("http")
        ? new URL(configuredBase)
        : new URL(configuredBase, current.origin);
}

function shouldRetryWithoutApiPrefix(url: string, endpoint: string): boolean {
    const configuredBase = String(import.meta.env.VITE_API_BASE_URL || "/api").trim();
    return !configuredBase || configuredBase === "/api"
        ? endpoint.trim().startsWith("/v1/")
            && url.includes("/api/v1/")
        : false;
}

function buildFallbackApiUrl(endpoint: string): string {
    const base = new URL(window.location.origin);
    applyEndpoint(base, endpoint);
    return base.toString();
}

function applyEndpoint(base: URL, endpoint: string) {
    const trimmed = endpoint.trim();
    const [pathPart, queryPart = ""] = trimmed.split("?");
    base.pathname = `${base.pathname.replace(/\/$/, "")}${pathPart}`;
    base.search = "";
    if (!queryPart) {
        return;
    }
    const params = new URLSearchParams(queryPart);
    params.forEach((value, key) => {
        base.searchParams.append(key, value);
    });
}

