// Upload only to the linked Vercel project's sensitive production environment.
// The PNG and its encoded value are never written to tracked files or CLI arguments.
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/configure-signature.mjs /private/path/signature.png');
const png = await fs.readFile(file);
if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Expected PNG signature');
const encoded = png.toString('base64');
const environment = { ...process.env };
delete environment.VERCEL_TOKEN;
const result = spawnSync('vercel', ['env', 'add', 'PROVIDER_SIGNATURE_BASE64', 'production', '--sensitive', '--force', '--yes', '--scope', 'devwithsmiles-projects'], { env: environment, input: encoded, encoding: 'utf8' });
for (const output of [result.stdout, result.stderr]) if (output) process.stdout.write(output.replaceAll(encoded, '[signature redacted]'));
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
