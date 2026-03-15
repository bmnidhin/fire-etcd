import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

// Path to the auger binary we installed via go install
const augerBinary = path.join(process.env.HOME || '/Users/nidhinbm', 'go', 'bin', 'auger');

export async function POST(request: Request) {
  try {
    const { valueBase64 } = await request.json();
    if (!valueBase64) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 });
    }

    // Decode base64 and pipe to auger
    const cmd = `echo "${valueBase64}" | base64 -d | ${augerBinary} decode`;
    const { stdout, stderr } = await execPromise(cmd);

    if (stderr && !stdout) {
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    return NextResponse.json({ yaml: stdout });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
