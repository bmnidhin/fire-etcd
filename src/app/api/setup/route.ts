import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { reinitializeEtcdClient } from '@/lib/etcd';

const execPromise = util.promisify(exec);

export async function GET() {
  const certsDir = path.join(process.cwd(), '.etcd-certs');
  const caPath = process.env.ETCD_CA_PATH || path.join(certsDir, 'ca.crt');
  const clientCertPath = process.env.ETCD_CLIENT_CERT_PATH || path.join(certsDir, 'client.crt');
  const clientKeyPath = process.env.ETCD_CLIENT_KEY_PATH || path.join(certsDir, 'client.key');

  const config = {
    caExists: fs.existsSync(caPath),
    clientCertExists: fs.existsSync(clientCertPath),
    clientKeyExists: fs.existsSync(clientKeyPath),
    host: process.env.ETCD_HOST || '127.0.0.1:2379',
  };

  return NextResponse.json(config);
}

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'start-etcd-ui.sh');
    const { stdout, stderr } = await execPromise(`bash ${scriptPath}`);
    
    // Attempt to re-initialize the client after setup
    reinitializeEtcdClient();

    return NextResponse.json({ success: true, stdout, stderr });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
