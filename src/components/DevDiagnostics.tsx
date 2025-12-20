import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface HealthState {
  status: "idle" | "ok" | "error";
  message: string;
}

interface AuthHealthState {
  status: "idle" | "ok" | "error" | "skipped";
  httpStatus?: number;
  message?: string;
}

const isDev = import.meta.env.DEV;
const EXPECTED_PROJECT_REF = "kqfyevdblvgxaycdvfxe";
type SupabaseKeyType = "publishable" | "jwt" | "unknown" | "missing";

function detectSupabaseKeyType(token: string | undefined): SupabaseKeyType {
  if (!token) return "missing";
  if (token.startsWith("sb_publishable_")) return "publishable";
  if (token.split(".").length === 3) return "jwt";
  return "unknown";
}

function decodeAnonKeyMeta(token: string | undefined): { ref: string | null; role: string | null; keyType: SupabaseKeyType } {
  const keyType = detectSupabaseKeyType(token);
  if (!token || keyType !== "jwt") {
    return { ref: null, role: null, keyType };
  }

  const parts = token.split(".");
  if (parts.length < 2) return { ref: null, role: null, keyType };

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    if (typeof atob === "undefined") {
      return { ref: null, role: null, keyType };
    }

    const json = atob(padded);
    const payload = JSON.parse(json) as { ref?: string; role?: string; user_role?: string };
    const ref = payload.ref ?? null;
    const role = payload.role ?? payload.user_role ?? null;

    return { ref, role, keyType };
  } catch {
    return { ref: null, role: null, keyType };
  }
}

export function DevDiagnostics() {
  const [health, setHealth] = useState<HealthState>({ status: "idle", message: "" });
  const [authHealth, setAuthHealth] = useState<AuthHealthState>({ status: "idle" });
  const { lastAuthError } = useAuth();

  if (!isDev) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "unknown";

  const { supabaseUrlSet, supabaseKeySet, supabaseHost, anonKeyRef, anonKeyRole, anonKeyRefMismatch, keyType, hostProjectRef } = useMemo(() => {
    const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    let host: string | null = null;
    if (rawUrl) {
      try {
        host = new URL(rawUrl).hostname;
      } catch {
        host = "invalid-url";
      }
    }

    const { ref, role, keyType } = decodeAnonKeyMeta(key);

    let hostProjectRef: string | null = null;
    if (host && host.endsWith(".supabase.co")) {
      hostProjectRef = host.split(".")[0] || null;
    }

    const anonKeyRefMismatch = keyType === "jwt" && Boolean(hostProjectRef && ref && hostProjectRef !== ref);

    return {
      supabaseUrlSet: Boolean(rawUrl),
      supabaseKeySet: Boolean(key),
      supabaseHost: host,
      anonKeyRef: ref,
      anonKeyRole: role,
      anonKeyRefMismatch,
      keyType,
      hostProjectRef,
    };
  }, []);

  useEffect(() => {
    if (!isDev) return;

    console.info("[DevDiagnostics] Supabase project ref (from URL)=", hostProjectRef ?? "(unknown)");
    console.info("[DevDiagnostics] Supabase key type=", keyType);
  }, [hostProjectRef, keyType]);

  useEffect(() => {
    if (!isDev) return;

    const run = async () => {
      console.info("[DevDiagnostics] Running Supabase health check (dev only)");
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id")
          .limit(1);

        if (error) {
          console.error("[DevDiagnostics] Supabase health error", {
            code: (error as any).code,
            message: error.message,
            details: (error as any).details,
            hint: (error as any).hint,
          });
          setHealth({
            status: "error",
            message:
              "Supabase query failed. Possible causes: RLS blocking dev user, wrong project, or missing migrations.",
          });
          return;
        }

        const rowCount = Array.isArray(data) ? data.length : 0;
        console.info("[DevDiagnostics] Supabase health ok", { rowCount });
        if (rowCount === 0) {
          console.info(
            "[DevDiagnostics] Empty result from events. Possible causes: no seed data, strict RLS, or wrong project ref."
          );
        }

        setHealth({
          status: "ok",
          message:
            rowCount > 0
              ? `Connected. Sample query returned ${rowCount} row(s).`
              : "Connected. Query returned 0 rows (check RLS or data).",
        });
      } catch (err: any) {
        console.error("[DevDiagnostics] Supabase health exception", {
          message: err?.message,
          code: err?.code,
        });
        setHealth({
          status: "error",
          message:
            "Network or connection error talking to Supabase. Check VITE_SUPABASE_URL, Codespaces networking, and project ref.",
        });
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (!isDev) return;

    const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!rawUrl) {
      setAuthHealth({ status: "skipped", message: "VITE_SUPABASE_URL not set" });
      return;
    }

    if (typeof fetch === "undefined") {
      setAuthHealth({ status: "skipped", message: "fetch not available in this environment" });
      return;
    }

    const base = rawUrl.replace(/\/+$/, "");
    const healthUrl = `${base}/auth/v1/health`;
    console.info("[DevDiagnostics] Running auth health check (dev only)", { healthUrl });

    const run = async () => {
      try {
        const res = await fetch(healthUrl, { method: "GET" });
        const allowOrigin = res.headers.get("access-control-allow-origin");
        const allowCreds = res.headers.get("access-control-allow-credentials");

        console.info("[DevDiagnostics] Auth health response", {
          status: res.status,
          accessControlAllowOrigin: allowOrigin,
          accessControlAllowCredentials: allowCreds,
        });

        if (res.ok) {
          setAuthHealth({ status: "ok", httpStatus: res.status, message: "Auth health OK" });
        } else {
          setAuthHealth({
            status: "error",
            httpStatus: res.status,
            message: `Auth health returned ${res.status}`,
          });
        }
      } catch (err: any) {
        console.error("[DevDiagnostics] Auth health exception", {
          message: err?.message,
          code: err?.code,
        });
        setAuthHealth({
          status: "error",
          message:
            "Network or CORS error calling auth health endpoint. Check Codespaces URL and Supabase project.",
        });
      }
    };

    void run();
  }, []);

  return (
    <div className="fixed bottom-3 right-3 z-[60] max-w-xs rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Dev diagnostics</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">local only</span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        {anonKeyRefMismatch && (
          <div className="mb-0.5 rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-[11px] text-red-600">
            <div className="font-semibold">Warning: anon key project mismatch</div>
            <div>
              Token ref {anonKeyRef ?? "(unknown)"} does not match Supabase URL project ref.
            </div>
            <div>
              Expected project ref: {EXPECTED_PROJECT_REF}. Update VITE_SUPABASE_ANON_KEY in .env.local to use the anon key from the correct Supabase project.
            </div>
          </div>
        )}
        <div>
          <span className="font-semibold">Origin:</span> {origin}
        </div>
        <div>
          <span className="font-semibold">VITE_SUPABASE_URL set:</span> {supabaseUrlSet ? "yes" : "no"}
        </div>
        <div>
          <span className="font-semibold">VITE_SUPABASE_ANON_KEY set:</span> {supabaseKeySet ? "yes" : "no"}
        </div>
        <div>
          <span className="font-semibold">Supabase key type:</span> {keyType}
        </div>
        <div>
          <span className="font-semibold">Supabase host:</span> {supabaseHost ?? "unset"}
        </div>
        <div>
          <span className="font-semibold">Health:</span>{" "}
          {health.status === "idle" ? "checking..." : `${health.status} – ${health.message}`}
        </div>
        <div>
          <span className="font-semibold">Auth health:</span>{" "}
          {authHealth.status === "idle"
            ? "checking..."
            : authHealth.status === "skipped"
            ? `skipped – ${authHealth.message}`
            : `${authHealth.status} – ${
                authHealth.httpStatus ? `HTTP ${authHealth.httpStatus}` : authHealth.message ?? "no message"
              }`}
        </div>
        <div>
          <span className="font-semibold">Last auth error:</span>{" "}
          {!lastAuthError
            ? "none"
            : `${lastAuthError.name ?? "Error"}: ${lastAuthError.message ?? "(no message)"}${
                lastAuthError.code ? ` [${lastAuthError.code}]` : ""
              }`}
        </div>
      </div>
    </div>
  );
}
