#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== SustainaBuild UI Baseline & Guardrails ==="
echo "Repository: $ROOT_DIR"
echo ""

echo "--- Service Baseline ---"
docker compose ps || true
echo ""

echo "--- UI Data Fetch Baseline (non-API app files) ---"
if command -v rg >/dev/null 2>&1; then
  UI_FETCH_MATCHES="$(rg -n '\bfetch\s*\(' apps/web/src/app --glob '!api/**' || true)"
else
  UI_FETCH_MATCHES="$(grep -RInE '\bfetch\s*\(' apps/web/src/app --exclude-dir=api || true)"
fi
if [ -n "$UI_FETCH_MATCHES" ]; then
  echo "$UI_FETCH_MATCHES"
  FETCH_COUNT="$(printf '%s\n' "$UI_FETCH_MATCHES" | sed '/^$/d' | wc -l | tr -d ' ')"
else
  FETCH_COUNT="0"
  echo "No direct fetch() usage found in apps/web/src/app (excluding api routes)."
fi
echo "Direct fetch() call count: $FETCH_COUNT"
echo ""

echo "--- Relay Hook Baseline ---"
for hook in usePreloadedQuery useFragment usePaginationFragment useMutation useSubscription; do
  if command -v rg >/dev/null 2>&1; then
    matches="$(rg -n "\\b$hook\\b" apps/web/src --glob '!**/*.d.ts' || true)"
  else
    matches="$(grep -RInE "\\b$hook\\b" apps/web/src --exclude='*.d.ts' || true)"
  fi
  if [ -n "$matches" ]; then
    count="$(printf '%s\n' "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"
  else
    count="0"
  fi
  echo "$hook: $count"
done
echo ""

if [ "${STRICT_RELAY_GUARDRAILS:-0}" = "1" ] && [ "$FETCH_COUNT" != "0" ]; then
  echo "STRICT_RELAY_GUARDRAILS=1 is set and direct fetch() calls were found."
  echo "Failing guardrail check."
  exit 1
fi

echo "Baseline guardrail check completed."
echo "Tip: run STRICT_RELAY_GUARDRAILS=1 for enforcement mode."
