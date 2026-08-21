# Vault + Vault Secrets Operator Runbook

This document walks you through bringing up HashiCorp Vault **in-cluster** (dev mode), installing the Vault Secrets Operator (VSO), and verifying that Kubernetes secrets are automatically materialised from Vault.

> Vault runs as a workload on the cluster itself (namespace `vault`), not on the host machine — this is the topology used for the Proxmox/MicroK8s deployment. If you just want to poke at Vault locally without touching the cluster, `start-vault-dev.sh` + `seed-secrets.sh` still start a plain host-mode Vault server, but that path is unrelated to what gets deployed.

---

## Prerequisites

| Tool | Install |
|------|---------|
| `vault` CLI | https://developer.hashicorp.com/vault/downloads |
| `kubectl` | Connected to your target cluster (e.g. MicroK8s) |
| `helm` | v3.x |

> **Run this from a master node, not your laptop, if MicroK8s's API server certificate doesn't cover the IP you'd otherwise reach it over.** MicroK8s's self-signed cert only has SANs for `127.0.0.1` and its internal cluster IPs by default — connecting over the node's LAN IP from a remote machine fails TLS verification (`x509: certificate is valid for ..., not <your IP>`) unless that IP was added to the cert's SANs (`microk8s refresh-certs`). Simplest fix: SSH into a master node — `kubectl`/`helm` work there without any cert issue since it's local. On the node:
> ```bash
> sudo snap alias microk8s.kubectl kubectl
> microk8s enable helm3
> sudo snap alias microk8s.helm3 helm
> ```
> Then `git clone` (or `scp`) this repo onto the node and run the steps below from there. Vault CLI isn't bundled with MicroK8s — install via HashiCorp's apt repo (Ubuntu/Debian):
> ```bash
> wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
> echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
> sudo apt update && sudo apt install vault
> ```

```bash
# Verify your cluster is reachable
kubectl get nodes
kubectl get ns distill-dev
```

---

## Step 1 — Install Vault In-Cluster

```bash
bash vault/install-vault-incluster.sh
```

**What it does:** Installs HashiCorp Vault via the official Helm chart into namespace `vault`, in dev mode (in-memory, auto-unsealed, root token `root`). Reachable in-cluster at `vault.vault.svc.cluster.local:8200` — this is the address already set in `charts/vault/vault-connection.yaml` and `charts/vso-values.yaml`.

> Dev mode is **not persistent** — all secrets are lost if the pod restarts. Fine for getting the pipeline working end-to-end; revisit with a real storage backend + auto-unseal before this matters for an always-on deployment.

---

## Step 2 — Port-Forward and Seed Secrets

Vault only has a ClusterIP inside the cluster, so reach it from your machine with a port-forward for the one-time setup steps:

```bash
kubectl port-forward -n vault svc/vault 8200:8200 &

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

## Step 3 — Install Vault Secrets Operator (VSO)

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

## Step 4 — Configure Kubernetes Auth in Vault

> Run after VSO is installed and the cluster is ready. Keep the port-forward from Step 2 running (or restart it).

```bash
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=root

bash vault/configure-k8s-auth.sh
```

**What it does:**
- Enables the `kubernetes` auth method in Vault
- Configures it to validate against the cluster's own in-cluster API service (`https://kubernetes.default.svc`), using the CA cert read from the node's local MicroK8s installation (`/var/snap/microk8s/current/certs/ca.crt`) — not via `kubectl exec`, which can hit the same node-IP/kubelet-cert mismatch documented below
- Creates a Vault policy granting read access to `secret/distill/processing`
- Creates a Vault role `distill-processing`, bound to a ServiceAccount named `vault-secrets-operator` **in the `distill-dev` namespace** — not VSO's own operator identity (see the note below)

---

## Step 5 — Create the ServiceAccount VSO Authenticates As

VSO doesn't use its own pod identity to log in to Vault — for each `VaultAuth` resource, it mints a fresh token (via the Kubernetes `TokenRequest` API) for whatever ServiceAccount is named in that CR's `spec.kubernetes.serviceAccount` field, and that ServiceAccount must exist **in the same namespace as the `VaultAuth` resource itself**. `charts/vault/vault-auth.yaml` names it `vault-secrets-operator` — easy to mistake for VSO's own operator ServiceAccount (which lives in `vault-secrets-operator-system` and is unrelated), so create it explicitly:

```bash
kubectl create serviceaccount vault-secrets-operator -n distill-dev
```

---

## Step 6 — Apply VSO Custom Resources

```bash
kubectl apply -f charts/vault/
```

This applies three CRDs in the `distill-dev` namespace:

| Resource | Name | Purpose |
|----------|------|---------|
| `VaultConnection` | `distill-vault-connection` | Points to `http://vault.vault.svc.cluster.local:8200` (in-cluster) |
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
- Ensure the Vault pod is running: `kubectl get pods -n vault`
- Confirm other pods can reach it in-cluster: `kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://vault.vault.svc.cluster.local:8200/v1/sys/health`

### VaultAuth not ready
- Check VSO logs: `kubectl logs -n vault-secrets-operator-system -l control-plane=controller-manager`
- Re-run `configure-k8s-auth.sh` after confirming the port-forward to `vault.vault.svc` is still up

### VaultStaticSecret not syncing
- Check the Vault policy allows the path: `vault policy read distill-processing-policy`
- Verify the KV path exists: `vault kv get secret/distill/processing`

### `kubectl port-forward` / `exec` fails with an x509 error like `certificate is valid for 10.10.10.X, not 192.168.2.X`
This means the target pod's node has a mismatch between its registered `InternalIP` (`kubectl get node <name> -o jsonpath='{.status.addresses}'`) and what its kubelet serving certificate actually covers — the API server can't safely dial that node's kubelet for streaming operations (port-forward, exec, `logs -f`). Non-streaming operations (`get`, `describe`, plain `logs`) are unaffected.
- **Quick workaround**: if the pod is on the node you're running commands from, bypass the kubelet-proxy path entirely — hit the pod's IP directly (`kubectl get pod <name> -o wide` for the IP) instead of using port-forward.
- **Real fix**: pin `--node-ip` explicitly in that node's kubelet args (`/var/snap/microk8s/current/args/kubelet`) to its intended cluster-internal address, then restart `kubelite` (`sudo systemctl restart snap.microk8s.daemon-kubelite`) — one node at a time, verifying the cluster recovers before moving to the next.

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────┐
│  Cluster (MicroK8s — 3 master / 3 worker, Proxmox)         │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Namespace: vault                                  │     │
│  │  Pod: vault-0 (dev mode, in-memory)               │     │
│  │  secret/distill/processing                       │     │
│  │    ├── GEMINI_API_KEY                            │     │
│  │    ├── PROCESSING_LOG_LEVEL                      │     │
│  │    └── PROCESSING_WORKERS                        │     │
│  └──────────────────────────────────────────────────┘     │
│                         ▲  vault.vault.svc.cluster.local   │
└─────────────────────────│───────────────────────────────┘
                          │
┌─────────────────────────│───────────────────────────────┐
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
