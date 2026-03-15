import { NextResponse } from 'next/server';
import { getEtcdClient } from '@/lib/etcd';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (key) {
      // Get single key value (base64 encoded as k8s data is protobuf)
      const valueBuffer = await getEtcdClient().get(key).buffer();
      if (!valueBuffer) {
         return NextResponse.json({ error: 'Key not found' }, { status: 404 });
      }
      return NextResponse.json({ key, value: valueBuffer.toString('base64'), stringValue: valueBuffer.toString('utf-8') });
    }

    if (prefix) {
      // Get by prefix
      const keys = await getEtcdClient().getAll().prefix(prefix).keys();
      return NextResponse.json({ keys });
    }

    // Get all keys
    const keys = await getEtcdClient().getAll().keys();
    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, value } = body;
        
        await getEtcdClient().put(key).value(value);
        return NextResponse.json({ success: true, key });
    } catch(err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

        await getEtcdClient().delete().key(key);
        return NextResponse.json({ success: true });
    } catch(err: any) {
       return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
