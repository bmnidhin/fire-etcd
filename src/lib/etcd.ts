import { Etcd3 } from 'etcd3';
import fs from 'fs';
import path from 'path';

// Use global fallback for hot-reloads in Next.js
declare global {
  var globalEtcdClient: Etcd3 | null | undefined;
}

let clientInstance: Etcd3 | null = global.globalEtcdClient || null;

export function reinitializeEtcdClient(): void {
  const certsDir = path.join(process.cwd(), '.etcd-certs');
  const caPath = process.env.ETCD_CA_PATH || path.join(certsDir, 'ca.crt');
  const clientCertPath = process.env.ETCD_CLIENT_CERT_PATH || path.join(certsDir, 'client.crt');
  const clientKeyPath = process.env.ETCD_CLIENT_KEY_PATH || path.join(certsDir, 'client.key');

  if (!fs.existsSync(caPath) || !fs.existsSync(clientCertPath) || !fs.existsSync(clientKeyPath)) {
    clientInstance = null;
    return;
  }

  clientInstance = new Etcd3({
    hosts: process.env.ETCD_HOST || '127.0.0.1:2379',
    credentials: {
      rootCertificate: fs.readFileSync(caPath),
      certChain: fs.readFileSync(clientCertPath),
      privateKey: fs.readFileSync(clientKeyPath),
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    global.globalEtcdClient = clientInstance;
  }
}

// Attempt initial load
if (!clientInstance) {
    reinitializeEtcdClient();
}

export function getEtcdClient(): Etcd3 {
  if (!clientInstance) {
    throw new Error('Etcd client is not configured. Please run the setup script.');
  }
  return clientInstance;
}
