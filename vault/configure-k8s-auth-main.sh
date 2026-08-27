#!/usr/bin/env bash
# ============================================================
# configure-k8s-auth-main.sh
# Creates the Vault policy + role for distill-main (prod)'s
# processing service. Mirrors configure-k8s-auth.sh for dev,
# but with an isolated policy/role/KV-path so prod can never
# read dev's secrets (same reasoning as the per-env
# MONGODB_URI split in charts/storage/values/{dev,prod}.yaml).
#
# Run this AFTER configure-k8s-auth.sh has already enabled the
# kubernetes auth method once (this script assumes it's enabled).
#
# Usage:
#   bash vault/configure-k8s-auth-main.sh
#
# Prerequisites:
#   - Vault running in-cluster, reachable via
#     `kubectl port-forward -n vault svc/vault 8200:8200`
#   - kubectl pointed at the target cluster (MicroK8s)
# ============================================================

set -euo pipefail

export VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:-root}"

VAULT_K8S_MOUNT="kubernetes"
VAULT_POLICY_NAME="distill-processing-main-policy"
VAULT_ROLE_NAME="distill-processing-main"

echo "==> Using Vault at ${VAULT_ADDR}"

# ----- 1. Create isolated Vault policy for prod -----
echo ""
echo "==> Creating Vault policy '${VAULT_POLICY_NAME}'..."
vault policy write "${VAULT_POLICY_NAME}" - <<'EOF'
# Allow VSO to read PROD processing secrets only (KV v2) —
# deliberately a different path from dev's secret/data/distill/processing
path "secret/data/distill/processing-main" {
  capabilities = ["read"]
}

path "secret/metadata/distill/processing-main" {
  capabilities = ["read", "list"]
}
EOF
echo "    Policy '${VAULT_POLICY_NAME}' created."

# ----- 2. Create Vault role bound to distill-main's ServiceAccount -----
echo ""
echo "==> Creating Vault role '${VAULT_ROLE_NAME}'..."
vault write "auth/${VAULT_K8S_MOUNT}/role/${VAULT_ROLE_NAME}" \
  bound_service_account_names="vault-secrets-operator" \
  bound_service_account_namespaces="distill-main" \
  policies="${VAULT_POLICY_NAME}" \
  ttl="24h"
echo "    Role '${VAULT_ROLE_NAME}' created."

echo ""
echo "✅  Kubernetes auth configured for distill-main."
echo ""
echo "Next steps:"
echo "  1. Create the ServiceAccount VSO logs in as (in distill-main):"
echo "       kubectl create serviceaccount vault-secrets-operator -n distill-main"
echo "  2. Seed the prod secret (separate path from dev!):"
echo "       vault kv put secret/distill/processing-main \\"
echo "         GEMINI_API_KEY=\"<real prod key>\" \\"
echo "         PROCESSING_LOG_LEVEL=\"info\" \\"
echo "         PROCESSING_WORKERS=\"4\""
echo "  3. Apply the CRDs:  kubectl apply -f charts/vault/"
echo "  4. Verify:          kubectl get vaultstaticsecret -n distill-main"
echo "                      kubectl get secret processing-secret -n distill-main"
