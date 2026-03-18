export const CONFIG = {
    APP_NAME: "Security App",
    VERSION: "1.0.0",
    GITHUB_URL: "https://github.com/uninote/security_app",
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "/api",
} as const;
