#!/usr/bin/env bash
# ============================================================
# start-vault-dev.sh
# Starts HashiCorp Vault in dev mode with a fixed root token.
#
# Usage:
#   bash vault/start-vault-dev.sh
#
# Requirements:
#   - vault binary in PATH  (https://developer.hashicorp.com/vault/downloads)
#   - Port 8200 must be free on the host
# ============================================================

set -euo pipefail

VAULT_ROOT_TOKEN="root"
VAULT_PORT="8200"

echo "==> Starting Vault in dev mode..."
echo "    Root Token : ${VAULT_ROOT_TOKEN}"
echo "    Listen Addr: 0.0.0.0:${VAULT_PORT}"
echo ""
echo "    Keep this terminal open. Run seed-secrets.sh in a new terminal."
echo ""

export VAULT_ADDR="http://127.0.0.1:${VAULT_PORT}"

vault server \
  -dev \
  -dev-root-token-id="${VAULT_ROOT_TOKEN}" \
  -dev-listen-address="0.0.0.0:${VAULT_PORT}"
