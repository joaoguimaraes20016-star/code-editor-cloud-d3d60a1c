#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Using local supabase CLI via pnpm exec (falls back to pnpm dlx)"

if command -v pnpm >/dev/null 2>&1; then
  SUPABASE_CMD="pnpm exec supabase"
else
  SUPABASE_CMD="pnpm dlx supabase@latest"
fi

echo "Deploying Supabase migrations..."
$SUPABASE_CMD migration deploy

echo "Deploying record-funnel-event Edge Function..."
$SUPABASE_CMD functions deploy record-funnel-event

echo "Finished deploying Supabase migrations and functions."
