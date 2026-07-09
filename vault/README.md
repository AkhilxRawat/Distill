# Phase 4.2 — Vault + Vault Secrets Operator Runbook

This document walks you through bringing up HashiCorp Vault in dev mode, installing the Vault Secrets Operator (VSO), and verifying that Kubernetes secrets are automatically materialised from Vault.

---

## Prerequisites

| Tool | Install |
|------|---------|
| `vault` CLI | https://developer.hashicorp.com/vault/downloads |
| `kubectl` | Connected to your `k3d-distill` cluster |
| `helm` | v3.x |
| `k3d` cluster | Running with `distill-dev` namespace |

```bash
# Verify your cluster is reachable
kubectl get nodes
kubectl get ns distill-dev
```

---

## Step 1 — Add the HashiCorp Helm Repo

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
```

---

## Step 2 — Start Vault Dev Server (Terminal 1)

> Keep this terminal open — Vault runs in the foreground.

```bash
bash vault/start-vault-dev.sh
```

**What it does:** Starts Vault in-memory dev mode, bound to `0.0.0.0:8200` with root token `root`. This makes it reachable from the k3d cluster nodes via `host.docker.internal:8200`.

---

## Step 3 — Seed Secrets into Vault (Terminal 2)

```bash
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root

bash vault/seed-secrets.sh
```

This writes the following keys to `secret/distill/processing` in Vault:

| Key | Default Value |
|-----|---------------|
| `GEMINI_API_KEY` | `your-gemini-api-key-here` |
| `PROCESSING_LOG_LEVEL` | `info` |
| `PROCESSING_WORKERS` | `4` |

> ✏️ **Update these with real credentials before use.**

---

## Step 4 — Install Vault Secrets Operator (VSO)

```bash
helm install vault-secrets-operator \
  hashicorp/vault-secrets-operator \
  --namespace vault-secrets-operator-system \
  --create-namespace \
  -f charts/vso-values.yaml

# Wait for VSO to be ready
kubectl rollout status deployment/vault-secrets-operator-controller-manager \
  -n vault-secrets-operator-system
```

---

## Step 5 — Configure Kubernetes Auth in Vault

> Run after VSO is installed and the cluster is ready.

```bash
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root
export KUBE_CONTEXT=k3d-distill   # adjust if your context name differs

bash vault/configure-k8s-auth.sh
```

**What it does:**
- Enables the `kubernetes` auth method in Vault
- Configures it with your cluster's API server address and CA cert
- Creates a Vault policy granting read access to `secret/distill/processing`
- Creates a Vault role `distill-processing` bound to the VSO service account

---

## Step 6 — Apply VSO Custom Resources

```bash
kubectl apply -f charts/vault/
```

This applies three CRDs in the `distill-dev` namespace:

| Resource | Name | Purpose |
|----------|------|---------|
| `VaultConnection` | `distill-vault-connection` | Points to `http://host.docker.internal:8200` |
| `VaultAuth` | `distill-vault-auth` | Kubernetes auth with role `distill-processing` |
| `VaultStaticSecret` | `processing-secret-sync` | Syncs Vault secret → K8s Secret `processing-secret` |

---

## Step 7 — Verify

```bash
# 1. VSO pod is running
kubectl get pods -n vault-secrets-operator-system

# 2. VaultConnection is ready
kubectl get vaultconnection -n distill-dev -o wide

# 3. VaultAuth is ready
kubectl get vaultauth -n distill-dev -o wide

# 4. VaultStaticSecret has synced
kubectl get vaultstaticsecret -n distill-dev -o wide

# 5. K8s Secret was materialised
kubectl get secret processing-secret -n distill-dev
kubectl describe secret processing-secret -n distill-dev

# 6. Decode a key to verify the value
kubectl get secret processing-secret -n distill-dev \
  -o jsonpath='{.data.GEMINI_API_KEY}' | base64 --decode
```

---

## Troubleshooting

### VaultConnection not ready
- Ensure Vault is running: `vault status`  
- Confirm k3d nodes can reach the host: `kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://host.docker.internal:8200/v1/sys/health`

### VaultAuth not ready
- Check VSO logs: `kubectl logs -n vault-secrets-operator-system -l control-plane=controller-manager`
- Re-run `configure-k8s-auth.sh` after confirming `kubectl config view` shows the right cluster

### VaultStaticSecret not syncing
- Check the Vault policy allows the path: `vault policy read distill-processing-policy`
- Verify the KV path exists: `vault kv get secret/distill/processing`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Host Machine                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Vault Dev Server (0.0.0.0:8200)                 │   │
│  │  secret/distill/processing                       │   │
│  │    ├── GEMINI_API_KEY                            │   │
│  │    ├── PROCESSING_LOG_LEVEL                      │   │
│  │    └── PROCESSING_WORKERS                        │   │
│  └──────────────────────────────────────────────────┘   │
│                         ▲  http://host.docker.internal   │
└─────────────────────────│───────────────────────────────┘
                          │
┌─────────────────────────│───────────────────────────────┐
│  k3d Cluster            │                               │
│                         │                               │
│  ┌──────────────────────┴─────────────────────────┐     │
│  │  Namespace: vault-secrets-operator-system       │     │
│  │  Pod: vault-secrets-operator (VSO)              │     │
│  │   ├── Reads VaultConnection                    │     │
│  │   ├── Authenticates via K8s auth               │     │
│  │   └── Polls Vault every 60s                    │     │
│  └────────────────────────┬────────────────────────┘     │
│                           │ creates/updates              │
│  ┌────────────────────────▼────────────────────────┐     │
│  │  Namespace: distill-dev                          │     │
│  │  VaultConnection: distill-vault-connection       │     │
│  │  VaultAuth:       distill-vault-auth             │     │
│  │  VaultStaticSecret: processing-secret-sync       │     │
│  │                          │                      │     │
│  │  Secret: processing-secret ◄─────────────────── │     │
│  │   ├── GEMINI_API_KEY                            │     │
│  │   ├── PROCESSING_LOG_LEVEL                      │     │
│  │   └── PROCESSING_WORKERS                        │     │
│  │                          │  envFrom.secretRef   │     │
│  │  Deployment: processing  ◄────────────────────  │     │
│  └──────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```
