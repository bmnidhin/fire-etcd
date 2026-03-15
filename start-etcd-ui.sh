#!/bin/bash
set -e

# Base directory for storing certs in the current workspace
CERTS_DIR="$(pwd)/.etcd-certs"

echo "🔒 1. Extracting etcd certificates from kind..."
mkdir -p "$CERTS_DIR"
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/ca.crt "$CERTS_DIR/ca.crt"
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/healthcheck-client.crt "$CERTS_DIR/client.crt"
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/healthcheck-client.key "$CERTS_DIR/client.key"

echo "🌐 2. Setting up secure port-forward to etcd (localhost:2379)..."
# Kill any existing port forwards for 2379
pkill -f "port-forward.*2379:2379" || true
kubectl port-forward -n kube-system pod/etcd-kind-control-plane 2379:2379 > /dev/null 2>&1 &

echo "🛠️ 3. Ensuring protobuf decoder (auger) is installed..."
if ! command -v auger &> /dev/null; then
    go install github.com/jpbetz/auger@latest || echo "auger install failed, some YAML features may not work."
fi

# We use subshell/export to pass the dynamic cert paths to Next.js
export ETCD_CA_PATH="$CERTS_DIR/ca.crt"
export ETCD_CLIENT_CERT_PATH="$CERTS_DIR/client.crt"
export ETCD_CLIENT_KEY_PATH="$CERTS_DIR/client.key"
export ETCD_HOST="127.0.0.1:2379"

echo "✅ Setup script completed successfully!"
