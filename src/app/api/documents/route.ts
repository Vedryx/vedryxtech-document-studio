import { agreementSchema } from '@/lib/agreement';
import { generateDownload } from '@/lib/generate';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 16_384;
const error = (message: string, status: number, fields?: unknown) => Response.json({ error: message, fields }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error('Send the request as JSON.', 415);
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return error('The request is too large.', 413);
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error('The request is empty.', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return error('The request is too large.', 413); }
      chunks.push(value);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return error('The request contains invalid JSON.', 400); }
  const result = agreementSchema.safeParse(payload);
  if (!result.success) return error('Check the highlighted agreement details.', 400, result.error.flatten().fieldErrors);
  try {
    const download = await generateDownload(result.data);
    // Stream PDF/ZIP files so bundles can exceed Vercel's buffered-response limit.
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= download.buffer.length) { controller.close(); return; }
        const end = Math.min(offset + 64 * 1024, download.buffer.length);
        controller.enqueue(new Uint8Array(download.buffer.subarray(offset, end)));
        offset = end;
      },
    });
    return new Response(stream, { headers: {
      'Content-Type': download.contentType,
      'Content-Disposition': `attachment; filename="${download.name}"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    // Never log submitted addresses, signatories, or document contents.
    console.error('Agreement generation failed. Check the document assets and signature configuration.');
    return error('We couldn’t generate the documents. Please try again.', 500);
  }
}
