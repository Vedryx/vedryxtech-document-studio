import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agreementSchema, agreementLabels, templateValues, type AgreementInput, type AgreementType } from './agreement';
import preview from '../data/preview.json';
import dda from '../data/dda.json';
import { sowParagraphs } from './sow';

type Paragraph = { text: string; heading: boolean; signature?: string };
const sources = { ...preview, dda };
const width = 468;
const left = 72;
const bottom = 716;

/** Canonical content matches the on-screen clauses; provider identity is never client-controlled. */
export function pdfParagraphs(input: AgreementInput, type: AgreementType): Paragraph[] {
  const fixed = agreementSchema.parse({ ...input, agreements: [type] });
  if (type === 'sow') return sowParagraphs(fixed);
  const values = templateValues(fixed) as Record<string, unknown>;
  return sources[type].map(p => ({ ...p, text: p.text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')) }));
}

export async function generatePdf(input: AgreementInput, type: AgreementType) {
  const encodedSignature = process.env.PROVIDER_SIGNATURE_BASE64;
  if (!encodedSignature) throw new Error('Provider signature is not configured');
  const signature = Buffer.from(encodedSignature, 'base64');
  if (!signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Provider signature must be a PNG');
  const fontDir = path.join(process.cwd(), 'node_modules/@fontsource/noto-sans/files');
  const [regular, bold, logo] = await Promise.all([
    readFile(path.join(fontDir, 'noto-sans-latin-400-normal.woff')),
    readFile(path.join(fontDir, 'noto-sans-latin-700-normal.woff')),
    readFile(path.join(process.cwd(), 'public/brand/logo.png')),
  ]);
  const document = new PDFDocument({ size: 'LETTER', margins: { top: 92, bottom: 76, left, right: left }, bufferPages: true, info: { Title: agreementLabels[type], Author: 'vedryxTech', Creator: 'vedryxTech Document Studio' } });
  document.registerFont('Body', regular).registerFont('Bold', bold);
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on('data', chunk => chunks.push(Buffer.from(chunk)));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  // Attach an immediate rejection handler while synchronously laying out the pages.
  void output.catch(() => {});
  const opts = { width, lineGap: 3, paragraphGap: 0 };
  let pageNumber = 0;
  let activeFont = 'Body';
  let activeSize = 10.5;
  let activeColor = '#172038';
  function pageFurniture() {
    pageNumber++;
    const { x, y } = document;
    const bottomMargin = document.page.margins.bottom;
    document.save();
    document.image(logo, 382, 34, { width: 158 });
    document.moveTo(left, 73).lineTo(540, 73).lineWidth(0.6).strokeColor('#1f5fff').stroke();
    document.page.margins.bottom = 0;
    document.font('Body').fontSize(8).fillColor('#64748b').text(`vedryxTech  ·  ${pageNumber}`, left, 746, { width, align: 'right', lineBreak: false });
    document.page.margins.bottom = bottomMargin;
    document.restore();
    document.font(activeFont).fontSize(activeSize).fillColor(activeColor);
    document.x = x;
    document.y = y;
  }
  document.on('pageAdded', pageFurniture);
  pageFurniture();
  function room(height: number) { if (document.y + height > bottom) document.addPage(); }
  function body(text: string, heading = false) {
    activeFont = heading ? 'Bold' : 'Body';
    activeSize = heading ? 12 : 10.5;
    activeColor = heading ? '#1f5fff' : '#172038';
    document.font(activeFont).fontSize(activeSize).fillColor(activeColor);
    if (heading) { room(document.heightOfString(text, opts) + 55); document.y += 10; }
    else room(26);
    document.text(text, left, document.y, opts);
    document.y += heading ? 10 : 8;
  }
  const paragraphs = pdfParagraphs(input, type);
  const signedDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(new Date());
  try {
    document.font('Bold').fontSize(21).fillColor('#172038').text(agreementLabels[type], left, document.y, { width, lineGap: 3 });
    document.y += 20;
    let signingParty = 0;
    for (let i = 1; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      if (p.signature === 'party') {
        const block = paragraphs.slice(i, i + 5);
        document.font('Bold').fontSize(12);
        let blockHeight = 15 + document.heightOfString(block[0].text, opts) + 20;
        document.font('Body').fontSize(10.5);
        blockHeight += block.slice(1, 3).reduce((sum, row) => sum + document.heightOfString(row.text, opts) + 8, 0);
        blockHeight += signingParty === 0 ? 69 + document.heightOfString(`Date signed: ${signedDate}`, opts) + 8 : 25 + block.slice(3, 5).reduce((sum, row) => sum + document.heightOfString(row.text, opts) + 8, 0);
        room(blockHeight + 22);
        document.y += 15;
        body(block[0].text, true);
        body(block[1].text);
        body(block[2].text);
        if (signingParty === 0) {
          document.y += 3;
          const y = document.y;
          document.image(signature, left, y, { fit: [180, 60], valign: 'center' });
          document.y = y + 66;
          body(`Date signed: ${signedDate}`);
        } else {
          document.y += 25;
          body(block[3].text);
          body(block[4].text);
        }
        document.y += 14;
        signingParty++;
        i += 4;
      } else body(p.text, p.heading);
    }
    document.end();
    return await output;
  } catch (error) {
    document.destroy();
    throw error;
  }
}
