#!/usr/bin/env bash
# ============================================================
# install-vault-incluster.sh
# Installs HashiCorp Vault as a workload on the cluster itself
# (dev mode: in-memory, auto-unsealed, single replica).
#
# Usage:
#   bash vault/install-vault-incluster.sh
#
# Requirements:
#   - helm v3.x
#   - kubectl pointed at the target cluster (e.g. MicroK8s)
#
# Note: dev mode is NOT persistent — all secrets are lost on pod
# restart. Fine for getting the pipeline working; revisit with a
# real storage backend + auto-unseal before this matters in prod.
# ============================================================

set -euo pipefail

VAULT_NAMESPACE="${VAULT_NAMESPACE:-vault}"

echo "==> Adding the HashiCorp Helm repo..."
helm repo add hashicorp https://helm.releases.hashicorp.com 2>/dev/null || true
helm repo update hashicorp

echo "==> Installing Vault (dev mode) into namespace '${VAULT_NAMESPACE}'..."
helm upgrade --install vault hashicorp/vault \
  --namespace "${VAULT_NAMESPACE}" \
  --create-namespace \
  --set "server.dev.enabled=true" \
  --set "server.dev.devRootToken=root" \
  --wait

echo ""
echo "==> Vault pod status:"
kubectl get pods -n "${VAULT_NAMESPACE}"

echo ""
echo "✅  Vault is running in-cluster at vault.${VAULT_NAMESPACE}.svc.cluster.local:8200"
echo ""
echo "Next steps:"
echo "  1. Port-forward so your local vault CLI can reach it:"
echo "       kubectl port-forward -n ${VAULT_NAMESPACE} svc/vault 8200:8200 &"
echo "       export VAULT_ADDR=http://127.0.0.1:8200"
echo "       export VAULT_TOKEN=root"
echo "  2. Seed secrets:    bash vault/seed-secrets.sh"
echo "  3. Install VSO:     helm install vault-secrets-operator hashicorp/vault-secrets-operator --namespace vault-secrets-operator-system --create-namespace -f charts/vso-values.yaml"
echo "  4. Configure auth:  bash vault/configure-k8s-auth.sh"
echo "  5. Apply CRDs:      kubectl apply -f charts/vault/"
