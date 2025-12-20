import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const devServerLogger = () => ({
  name: "dev-server-logger",
  configureServer(server: any) {
    server.httpServer?.once("listening", () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "unknown";
      const urls = (server as any).resolvedUrls;

      console.info("[Dev][Vite] Dev server is running.");
      console.info("[Dev][Vite] Current browser origin:", origin);

      if (urls?.local?.length || urls?.network?.length) {
        (urls.local || []).forEach((url: string) =>
          console.info("[Dev][Vite] Local URL:", url)
        );
        (urls.network || []).forEach((url: string) =>
          console.info("[Dev][Vite] Network URL:", url)
        );
      } else {
        console.info(
          "[Dev][Vite] Host/port:",
          server.config.server.host,
          server.config.server.port
        );
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: false,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && devServerLogger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
