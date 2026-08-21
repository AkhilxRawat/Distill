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

VAULT_K8S_MOUNT="kubernetes"
VAULT_POLICY_NAME="distill-processing-policy"
VAULT_ROLE_NAME="distill-processing"

# The cluster CA cert used to validate service-account tokens. MicroK8s
# keeps its own copy of it on every node's local filesystem, so read it
# there directly rather than via `kubectl exec` into a pod — the exec/
# port-forward path goes through the API server dialing back to that
# pod's node's kubelet, which can fail TLS verification if the node's
# registered address doesn't match its kubelet serving cert (a real,
# separate issue we hit — see vault/README.md troubleshooting).
MICROK8S_CA_CERT="${MICROK8S_CA_CERT:-/var/snap/microk8s/current/certs/ca.crt}"

echo "==> Using Vault at ${VAULT_ADDR}"

# ----- 1. Get Kubernetes cluster info for Vault -----
# Vault now runs inside the same cluster it's protecting, so it
# validates service-account tokens against the cluster's own
# in-cluster API service — not an external host/IP.
K8S_HOST="https://kubernetes.default.svc"
echo ""
echo "==> Reading Kubernetes CA cert from ${MICROK8S_CA_CERT}..."
K8S_CA_CERT=$(cat "${MICROK8S_CA_CERT}")

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
# VSO mints a fresh token via the Kubernetes TokenRequest API for the
# ServiceAccount named in the VaultAuth CR's spec.kubernetes.serviceAccount
# field — NOT using VSO's own operator identity from
# vault-secrets-operator-system. That ServiceAccount must exist in the same
# namespace as the VaultAuth resource itself (distill-dev), which is why the
# role below binds to that namespace, not VSO's own.
echo ""
echo "==> Creating Vault role '${VAULT_ROLE_NAME}'..."
vault write "auth/${VAULT_K8S_MOUNT}/role/${VAULT_ROLE_NAME}" \
  bound_service_account_names="vault-secrets-operator" \
  bound_service_account_namespaces="distill-dev" \
  policies="${VAULT_POLICY_NAME}" \
  ttl="24h"

echo "    Role '${VAULT_ROLE_NAME}' created."
echo ""
echo "✅  Kubernetes auth configured successfully."
echo ""
echo "Next steps:"
echo "  1. Apply VSO CRDs:  kubectl apply -f charts/vault/"
echo "  2. Verify:          kubectl get vaultstaticsecretsync -n distill-dev"
