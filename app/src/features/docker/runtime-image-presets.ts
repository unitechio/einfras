export type ImageDeployPreset = {
    key: string;
    match: (imageRef: string) => boolean;
    suggestedPorts?: string[];
    volumeTargets?: string[];
    defaultContainerName?: string;
    suggestedMemory?: string;
    suggestedCpus?: string;
    healthcheckCommand?: string;
    logging?: {
        driver: string;
        maxSize: string;
        maxFile: string;
    };
    requiredEnvGroups?: string[][];
    defaultEnv?: Record<string, string>;
};

const randomSecret = () => {
    const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 18 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

const presets: ImageDeployPreset[] = [
    {
        key: "nexus",
        match: (imageRef) => imageRef.includes("sonatype/nexus") || imageRef.includes("nexus3"),
        suggestedPorts: ["8081:8081"],
        volumeTargets: ["/nexus-data"],
        defaultContainerName: "nexus",
        suggestedMemory: "2g",
        suggestedCpus: "1.0",
        healthcheckCommand: 'CMD curl -f http://localhost:8081 || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "nginx",
        match: (imageRef) => imageRef.includes("nginx"),
        suggestedPorts: ["80:80"],
        volumeTargets: ["/usr/share/nginx/html"],
        defaultContainerName: "nginx",
        suggestedMemory: "256m",
        suggestedCpus: "0.50",
        healthcheckCommand: 'CMD-SHELL wget -q -O- http://localhost || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "postgres",
        match: (imageRef) => imageRef.startsWith("postgres:") || imageRef.endsWith("/postgres"),
        suggestedPorts: ["5432:5432"],
        volumeTargets: ["/var/lib/postgresql/data"],
        defaultContainerName: "postgres",
        suggestedMemory: "1g",
        suggestedCpus: "1.0",
        requiredEnvGroups: [["POSTGRES_PASSWORD"]],
        defaultEnv: { POSTGRES_PASSWORD: randomSecret() },
        healthcheckCommand: 'CMD-SHELL pg_isready -U postgres || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "mariadb",
        match: (imageRef) => imageRef.startsWith("mariadb:") || imageRef.includes("/mariadb"),
        suggestedPorts: ["3306:3306"],
        volumeTargets: ["/var/lib/mysql"],
        defaultContainerName: "mariadb",
        suggestedMemory: "1g",
        suggestedCpus: "1.0",
        requiredEnvGroups: [["MARIADB_ROOT_PASSWORD", "MARIADB_ROOT_PASSWORD_HASH", "MARIADB_ALLOW_EMPTY_ROOT_PASSWORD", "MARIADB_RANDOM_ROOT_PASSWORD"]],
        defaultEnv: { MARIADB_ROOT_PASSWORD: randomSecret() },
        healthcheckCommand: 'CMD-SHELL mariadb-admin ping -uroot -p"$MARIADB_ROOT_PASSWORD" || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "mysql",
        match: (imageRef) => imageRef.startsWith("mysql:") || imageRef.includes("/mysql"),
        suggestedPorts: ["3306:3306"],
        volumeTargets: ["/var/lib/mysql"],
        defaultContainerName: "mysql",
        suggestedMemory: "1g",
        suggestedCpus: "1.0",
        requiredEnvGroups: [["MYSQL_ROOT_PASSWORD", "MYSQL_ALLOW_EMPTY_PASSWORD", "MYSQL_RANDOM_ROOT_PASSWORD"]],
        defaultEnv: { MYSQL_ROOT_PASSWORD: randomSecret() },
        healthcheckCommand: 'CMD-SHELL mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "redis",
        match: (imageRef) => imageRef.startsWith("redis:") || imageRef.includes("/redis"),
        suggestedPorts: ["6379:6379"],
        volumeTargets: ["/data"],
        defaultContainerName: "redis",
        suggestedMemory: "512m",
        suggestedCpus: "0.50",
        healthcheckCommand: "CMD redis-cli ping",
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
    {
        key: "keycloak",
        match: (imageRef) => imageRef.includes("keycloak"),
        suggestedPorts: ["8080:8080"],
        volumeTargets: ["/opt/keycloak/data"],
        defaultContainerName: "keycloak",
        suggestedMemory: "1g",
        suggestedCpus: "1.0",
        requiredEnvGroups: [["KEYCLOAK_ADMIN"], ["KEYCLOAK_ADMIN_PASSWORD"]],
        defaultEnv: { KEYCLOAK_ADMIN: "admin", KEYCLOAK_ADMIN_PASSWORD: randomSecret() },
        healthcheckCommand: 'CMD-SHELL /opt/keycloak/bin/kc.sh show-config >/dev/null 2>&1 || exit 1',
        logging: { driver: "json-file", maxSize: "10m", maxFile: "3" },
    },
];

export function getImageDeployPreset(imageRef: string): ImageDeployPreset | undefined {
    const normalized = imageRef.trim().toLowerCase();
    if (!normalized) return undefined;
    return presets.find((preset) => preset.match(normalized));
}

export function buildRequiredRuntimeEnv(imageRef: string, current: Record<string, string> = {}) {
    const preset = getImageDeployPreset(imageRef);
    const next = { ...current };
    const autofilled: string[] = [];

    const setIfMissing = (key: string, value: string) => {
        if (!next[key]?.trim()) {
            next[key] = value;
            autofilled.push(key);
        }
    };

    if (preset?.defaultEnv) {
        Object.entries(preset.defaultEnv).forEach(([key, value]) => setIfMissing(key, value));
    }

    return {
        environment: next,
        autofilled,
        preset,
    };
}

export function getRequiredEnvWarnings(imageRef: string, current: Record<string, string> = {}) {
    const preset = getImageDeployPreset(imageRef);
    if (!preset?.requiredEnvGroups?.length) {
        return [];
    }
    return preset.requiredEnvGroups
        .filter((group) => !group.some((key) => current[key]?.trim()))
        .map((group) => `Missing one of: ${group.join(", ")}`);
}

export function getVolumeTargetWarnings(imageRef: string, targets: string[]) {
    const preset = getImageDeployPreset(imageRef);
    if (!preset?.volumeTargets?.length) {
        return [];
    }
    const normalizedTargets = targets.map((item) => item.trim()).filter(Boolean);
    if (normalizedTargets.length === 0) {
        return [`Recommended mount path: ${preset.volumeTargets.join(", ")}`];
    }
    const matched = preset.volumeTargets.some((target) => normalizedTargets.includes(target));
    return matched ? [] : [`Recommended mount path: ${preset.volumeTargets.join(", ")}`];
}

export function getSuggestedPortMappings(imageRef: string) {
    return getImageDeployPreset(imageRef)?.suggestedPorts ?? [];
}
