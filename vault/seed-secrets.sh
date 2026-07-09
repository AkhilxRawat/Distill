#!/usr/bin/env bash
# ============================================================
# seed-secrets.sh
# Seeds the Vault KV engine with Distill application secrets.
#
# Usage:
#   bash vault/seed-secrets.sh
#
# Prerequisites:
#   - Vault dev server running (start-vault-dev.sh)
#   - vault CLI in PATH
# ============================================================

set -euo pipefail

export VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:-root}"

echo "==> Connected to Vault at ${VAULT_ADDR}"

# ----- Enable KV v2 secrets engine at 'secret/' -----
# (already enabled by default in dev mode, but safe to re-enable)
echo "==> Ensuring 'secret/' KV-v2 engine is enabled..."
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "    Already enabled, skipping."

# ----- Seed processing service secrets -----
echo "==> Writing secret/distill/processing ..."
vault kv put secret/distill/processing \
  GEMINI_API_KEY="your-gemini-api-key-here" \
  PROCESSING_LOG_LEVEL="info" \
  PROCESSING_WORKERS="4"

echo ""
echo "==> Verifying written secret..."
vault kv get secret/distill/processing

echo ""
echo "✅  Secrets seeded successfully."
echo "    Update the values above with real credentials before production use."
