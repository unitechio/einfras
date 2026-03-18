import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    root: "app",
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "app/src"),
            "@assets": path.resolve(__dirname, "app/assets"),
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api/v1": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/health": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            "/ws": {
                target: "http://localhost:8080",
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
});
