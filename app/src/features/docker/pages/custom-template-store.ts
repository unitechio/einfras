export interface CustomTemplate {
    id: number;
    name: string;
    type: string;
    lastUpdated: string;
    author: string;
    content: string;
    settings: string;
}

const STORAGE_KEY = "einfra_custom_templates";

const initialTemplates: CustomTemplate[] = [
    { id: 1, name: "Production Web Stack", type: "Compose", lastUpdated: "2026-03-10", author: "Admin", content: "services:\n  web:\n    image: nginx:stable-alpine", settings: "environment=prod\nreplicas=2" },
    { id: 2, name: "Internal Tools (Metabase + Postgres)", type: "Compose", lastUpdated: "2026-02-28", author: "Admin", content: "services:\n  metabase:\n    image: metabase/metabase:latest", settings: "db=postgres\nbackup=true" },
    { id: 3, name: "Redis Cache Cluster", type: "Container", lastUpdated: "2026-03-05", author: "Admin", content: "image: redis:7-alpine", settings: "maxmemory-policy=allkeys-lru" },
];

export function loadTemplates() {
    if (typeof window === "undefined") {
        return initialTemplates;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return initialTemplates;
    }
    try {
        return JSON.parse(raw) as CustomTemplate[];
    } catch {
        return initialTemplates;
    }
}

export function saveTemplates(items: CustomTemplate[]) {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function findTemplateById(id: string | undefined) {
    if (!id) return null;
    return loadTemplates().find((item) => String(item.id) === id) || null;
}
