/** Upgrade existing templates without changing the agreement clauses. */
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { normalizeSignatures } from './signature-template.mjs';
import { signatureParagraphs } from '../src/lib/signatures.mjs';
const previews = JSON.parse(await fs.readFile('src/data/preview.json', 'utf8'));
for (const type of ['nda', 'msa', 'dda']) {
  const zip = new PizZip(await fs.readFile(`templates/${type}.docx`));
  normalizeSignatures(zip);
  await fs.writeFile(`templates/${type}.docx`, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const content = type === 'dda' ? JSON.parse(await fs.readFile('src/data/dda.json', 'utf8')) : previews[type];
  const start = content.findIndex(p => /^(Company: \{providerName\}|For \{providerName\})/.test(p.text.trim()));
  if (start < 0) throw new Error(`Missing ${type} preview signature block`);
  content.splice(start, content.length - start, ...signatureParagraphs());
  if (type === 'dda') await fs.writeFile('src/data/dda.json', JSON.stringify(content, null, 2) + '\n');
}
await fs.writeFile('src/data/preview.json', JSON.stringify(previews, null, 2) + '\n');
