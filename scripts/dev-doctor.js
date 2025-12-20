#!/usr/bin/env node

/**
 * GRWTH-OP Dev Doctor
 *
 * Usage: npm run doctor
 *
 * This script is read-only: it inspects the local environment and prints
 * diagnostics that help debug auth/origin/CORS issues in Codespaces.
 */

import fs from "fs";
import path from "path";
import url from "url";

const root = process.cwd();

const EXPECTED_PROJECT_REF = "kqfyevdblvgxaycdvfxe";

function logSection(title) {
  console.log("\n=== " + title + " ===");
}

function detectPackageManager() {
  const hasPnpm = fs.existsSync(path.join(root, "pnpm-lock.yaml"));
  const hasBun = fs.existsSync(path.join(root, "bun.lockb"));
  const hasYarn = fs.existsSync(path.join(root, "yarn.lock"));
  const hasNpm = fs.existsSync(path.join(root, "package-lock.json"));

  if (hasPnpm) return "pnpm";
  if (hasBun) return "bun";
  if (hasYarn) return "yarn";
  if (hasNpm) return "npm";
  return "npm";
}

function loadDotEnv() {
  const file = ".env.local";
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    return;
  }
  try {
    const content = fs.readFileSync(full, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn("[doctor] Failed to read", file, "-", err?.message || err);
  }
}

function getEnvSnapshot() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKeyPresent = Boolean(process.env.VITE_SUPABASE_ANON_KEY);
  let host = null;
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      host = "invalid-url";
    }
  }
  return {
    supabaseUrlPresent: Boolean(url),
    supabaseAnonKeyPresent: anonKeyPresent,
    supabaseHost: host,
    supabaseUrl: url || null,
  };
}

function detectSupabaseKeyType(anonKey) {
  if (!anonKey) return "missing";
  if (anonKey.startsWith("sb_publishable_")) return "publishable";
  if (anonKey.split(".").length === 3) return "jwt";
  return "unknown";
}

function decodeSupabaseAnonKey(anonKey) {
  const keyType = detectSupabaseKeyType(anonKey);

  if (!anonKey) {
    return { keyType, tokenRef: null, tokenRole: null, error: "VITE_SUPABASE_ANON_KEY is not set" };
  }

  if (keyType !== "jwt") {
    // New publishable keys and unknown formats are not JWTs; skip decode.
    return { keyType, tokenRef: null, tokenRole: null, error: null };
  }

  const parts = anonKey.split(".");
  if (parts.length < 2) {
    return { keyType, tokenRef: null, tokenRole: null, error: "Invalid JWT format for anon key" };
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);

    const tokenRef = payload?.ref ?? null;
    const tokenRole = payload?.role ?? payload?.user_role ?? null;

    return { keyType, tokenRef, tokenRole, error: null };
  } catch (err) {
    return {
      keyType,
      tokenRef: null,
      tokenRole: null,
      error: err?.message || "Failed to decode anon key JWT payload",
    };
  }
}

async function detectVitePort() {
  if (typeof fetch === "undefined") {
    console.log("[doctor] global fetch not available in this Node runtime; skipping Vite port probe.");
    return null;
  }

  const candidates = [8080, 8081, 8082, 8083, 8084];

  for (const port of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__vite_ping`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        console.log(`[doctor] Detected active Vite dev server on port ${port}.`);
        return port;
      }
    } catch {
      clearTimeout(timeout);
      // ignore and try next port
    }
  }

  console.log("[doctor] Could not find an active Vite dev server on ports 8080–8084.");
  console.log("[doctor] Make sure `pnpm dev` is running in another terminal.");
  return null;
}

async function checkSupabaseAuthHealth(env) {
  if (!env.supabaseUrl) {
    console.log("[doctor] VITE_SUPABASE_URL is not set; skipping auth health check.");
    return { status: "skipped", details: "VITE_SUPABASE_URL not set" };
  }

  if (typeof fetch === "undefined") {
    console.log("[doctor] global fetch not available; cannot perform auth health check.");
    return { status: "skipped", details: "fetch not available" };
  }

  const base = env.supabaseUrl.replace(/\/+$/, "");
  const authHealthUrl = `${base}/auth/v1/health`;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const headers = {};
  if (anonKey) {
    headers["apikey"] = anonKey;
    headers["Authorization"] = `Bearer ${anonKey}`;
  }

  console.log("[doctor] Fetching Supabase auth health:", authHealthUrl);
  if (!anonKey) {
    console.log("[doctor] VITE_SUPABASE_ANON_KEY is not set; auth health request will be unauthenticated.");
  }

  try {
    const res = await fetch(authHealthUrl, { method: "GET", headers });
    const allowOrigin = res.headers.get("access-control-allow-origin");

    console.log("[doctor] Auth health response:");
    console.log("  HTTP status:", res.status);
    console.log("  access-control-allow-origin:", allowOrigin ?? "(none)");

    if (res.status === 401 || res.status === 403) {
      console.log(
        "  hint:",
        "Received",
        res.status,
        "from auth health endpoint. This usually means the anon key is missing or invalid for this project, or auth is misconfigured."
      );
    }

    return {
      status: res.ok ? "ok" : "error",
      httpStatus: res.status,
      accessControlAllowOrigin: allowOrigin,
    };
  } catch (err) {
    console.log("[doctor] Auth health request failed:");
    console.log("  error:", err?.message || String(err));
    return {
      status: "error",
      details: err?.message || String(err),
    };
  }
}

async function main() {
  logSection("GRWTH-OP Dev Doctor");

  const pkgManager = detectPackageManager();
  console.log("Detected package manager:", pkgManager);

  logSection("Environment");
  loadDotEnv();
  const env = getEnvSnapshot();
  console.log("VITE_SUPABASE_URL present:", env.supabaseUrlPresent);
  console.log("VITE_SUPABASE_ANON_KEY present:", env.supabaseAnonKeyPresent);
  console.log("Supabase host:", env.supabaseHost ?? "unset");

  logSection("Supabase anon key");
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const { keyType, tokenRef, tokenRole, error: decodeError } = decodeSupabaseAnonKey(anonKey);

  console.log("[doctor] Supabase key type:", keyType);

  if (decodeError && keyType === "jwt") {
    console.log("[doctor] anon key decode error:", decodeError);
  }

  if (keyType === "jwt" && tokenRef) {
    if (tokenRef !== EXPECTED_PROJECT_REF) {
      console.log("❌ INVALID ANON KEY FOR PROJECT");
      console.log(
        "[doctor] Anon key belongs to Supabase project ref:",
        tokenRef
      );
      console.log(
        "[doctor] But VITE_SUPABASE_URL is configured for project ref:",
        EXPECTED_PROJECT_REF
      );
      console.log(
        "[doctor] ACTION: Generate a new anon key for the correct Supabase project and update VITE_SUPABASE_ANON_KEY in .env.local."
      );
    } else {
      console.log("✅ Anon key ref matches expected project ref", EXPECTED_PROJECT_REF);
    }
  }

   if (env.supabaseHost && env.supabaseHost.endsWith(".app.github.dev")) {
    console.warn(
      "[doctor][WARN] VITE_SUPABASE_URL host ends with .app.github.dev. This is a Codespaces URL, not a Supabase project URL."
    );
    console.warn(
      "[doctor][WARN] Update VITE_SUPABASE_URL to https://<project-ref>.supabase.co in your .env.local file."
    );
  }

  if (env.supabaseHost && env.supabaseHost.includes("-54321")) {
    console.warn(
      "[doctor][WARN] VITE_SUPABASE_URL host contains -54321, which usually indicates a forwarded Codespaces port, not Supabase."
    );
  }
  if (env.supabaseUrl) {
    console.log("VITE_SUPABASE_URL:", env.supabaseUrl);
  }

  if (env.supabaseHost && (env.supabaseHost.endsWith(".app.github.dev") || env.supabaseHost.includes("-54321"))) {
    console.log("\n[doctor][WARNING] VITE_SUPABASE_URL looks like a Codespaces URL, not a Supabase project URL.");
    console.log("[doctor][WARNING] Current host:", env.supabaseHost);
    console.log("[doctor][WARNING] It should look like <project-ref>.supabase.co, e.g. https://inbvluddkutyfhsxfqco.supabase.co");
    console.log("[doctor][WARNING] It should look like <project-ref>.supabase.co, e.g. https://kqfyevdblvgxaycdvfxe.supabase.co");
    console.log("[doctor][ACTION] Update VITE_SUPABASE_URL in your .env.local using .env.example as a guide.");
  }

  logSection("Vite dev server");
  const vitePort = await detectVitePort();
  if (vitePort) {
    console.log("Active Vite port:", vitePort);
    console.log(
      "If you are in Codespaces, the correct URL should be the forwarded *.app.github.dev URL for this port."
    );
  }

  logSection("Supabase auth health");
  await checkSupabaseAuthHealth(env);

  console.log("\nDev doctor check complete. Use the information above to align:");
  console.log("- Codespaces forwarded port ⇄ active Vite port");
  console.log("- Browser origin (*.app.github.dev) ⇄ Supabase host and CORS headers");
}

// Only run if executed directly (not imported)
if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[doctor] Unexpected error:", err);
    process.exitCode = 1;
  });
}
