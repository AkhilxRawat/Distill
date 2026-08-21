#!/usr/bin/env bash
# ============================================================
# configure-k8s-auth.sh
# Enables Kubernetes auth method in Vault and creates the
# policy + role used by the Vault Secrets Operator (VSO).
#
# Usage:
#   bash vault/configure-k8s-auth.sh
#
# Prerequisites:
#   - Vault running in-cluster (install-vault-incluster.sh),
#     reachable via `kubectl port-forward -n vault svc/vault 8200:8200`
#   - kubectl pointed at the target cluster (e.g. MicroK8s)
#   - VSO already installed in the cluster
# ============================================================

set -euo pipefail

export VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:-root}"

KUBE_CONTEXT="${KUBE_CONTEXT:-}"  # leave unset to use your current context
VAULT_NAMESPACE="${VAULT_NAMESPACE:-vault}"
VAULT_POD="${VAULT_POD:-vault-0}"
VAULT_K8S_MOUNT="kubernetes"
VAULT_POLICY_NAME="distill-processing-policy"
VAULT_ROLE_NAME="distill-processing"

KCTX_ARGS=()
[ -n "${KUBE_CONTEXT}" ] && KCTX_ARGS=(--context="${KUBE_CONTEXT}")

echo "==> Using Vault at ${VAULT_ADDR}"

# ----- 1. Get Kubernetes cluster info for Vault -----
# Vault now runs inside the same cluster it's protecting, so it
# validates service-account tokens against the cluster's own
# in-cluster API service — not an external host/IP. The CA cert
# is read straight from Vault's own pod so it matches exactly
# what Vault itself trusts.
K8S_HOST="https://kubernetes.default.svc"
echo ""
echo "==> Fetching Kubernetes CA cert from the Vault pod..."
K8S_CA_CERT=$(kubectl ${KCTX_ARGS[@]+"${KCTX_ARGS[@]}"} exec -n "${VAULT_NAMESPACE}" "${VAULT_POD}" -- \
  cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt)

# ----- 2. Enable Kubernetes auth method -----
echo ""
echo "==> Enabling Kubernetes auth method in Vault..."
vault auth enable -path="${VAULT_K8S_MOUNT}" kubernetes 2>/dev/null || \
  echo "    Already enabled, skipping."

# ----- 3. Configure the Kubernetes auth method -----
echo "==> Configuring Kubernetes auth backend..."
vault write "auth/${VAULT_K8S_MOUNT}/config" \
  kubernetes_host="${K8S_HOST}" \
  kubernetes_ca_cert="${K8S_CA_CERT}" \
  issuer="https://kubernetes.default.svc.cluster.local"

# ----- 4. Create Vault policy -----
echo ""
echo "==> Creating Vault policy '${VAULT_POLICY_NAME}'..."
vault policy write "${VAULT_POLICY_NAME}" - <<'EOF'
# Allow VSO to read processing secrets (KV v2)
path "secret/data/distill/processing" {
  capabilities = ["read"]
}

# Allow VSO to list secret versions
path "secret/metadata/distill/processing" {
  capabilities = ["read", "list"]
}
EOF

echo "    Policy '${VAULT_POLICY_NAME}' created."

# ----- 5. Create Vault role bound to Kubernetes service account -----
echo ""
echo "==> Creating Vault role '${VAULT_ROLE_NAME}'..."
vault write "auth/${VAULT_K8S_MOUNT}/role/${VAULT_ROLE_NAME}" \
  bound_service_account_names="vault-secrets-operator" \
  bound_service_account_namespaces="vault-secrets-operator-system" \
  policies="${VAULT_POLICY_NAME}" \
  ttl="24h"

echo "    Role '${VAULT_ROLE_NAME}' created."
echo ""
echo "✅  Kubernetes auth configured successfully."
echo ""
echo "Next steps:"
echo "  1. Apply VSO CRDs:  kubectl apply -f charts/vault/"
echo "  2. Verify:          kubectl get vaultstaticsecretsync -n distill-dev"
