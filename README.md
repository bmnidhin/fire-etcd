# fireETCD

A modern, web interface to explore and modify the raw etcd database for your local `kind` Kubernetes cluster. Built with Next.js, `monaco-editor`, and `etcd3`.

This only tested against a `kind` cluster at the moment. Feel free to use it against any cluster

![UI](/assets/app.png)



## Features

*   **Direct etcd Access**: Connects directly to the `kind` etcd node via mTLS.
*   **Decoder**: Automatically decodes the protobuf records into YAML using the `auger` tool.
*   **Monaco Editor Integration**: View and edit the decoded keys with full syntax highlighting.
*   **Tree Explorer**: Navigate the dense `/registry/` structure effortlessly.

---

## How to Run Locally

If you've just restarted your machine, you'll need to re-establish the connection to the ephemeral `kind` cluster and start the web server. Follow these steps:



### 1. Ensure your Cluster is Running
Make sure Docker is running and your `kind` cluster is active.
```bash
kind get clusters
```

### 2. Extract etcd Certificates
The backend requires mutual TLS to authenticate to etcd. We must copy these certificates out of the control-plane container into a folder on your host machine:

#### Option 1

Run Setup from the UI to copy certs

#### Option 2

Manual steps

```bash
mkdir -p ~/etcd-certs
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/ca.crt ~/etcd-certs/ca.crt
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/healthcheck-client.crt ~/etcd-certs/client.crt
docker cp kind-control-plane:/etc/kubernetes/pki/etcd/healthcheck-client.key ~/etcd-certs/client.key
```

### 3. Port-Forwarding
Next, expose the internal etcd pod to your local machine (assuming `localhost:2379`) so the backend can reach it:

```bash
kubectl port-forward -n kube-system pod/etcd-kind-control-plane 2379:2379 > /dev/null 2>&1 &
```

### 4. Install the YAML Decoder (Auger)
To decode Kubernetes protobufs into YAML, ensure you have the `auger` Go binary installed and accessible in your path.
```bash
go install github.com/jpbetz/auger@latest
```
*(Ensure `~/go/bin` is in your system's `$PATH`)*

### 5. Start the Next.js Server
Finally, navigate to this project's directory and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!
