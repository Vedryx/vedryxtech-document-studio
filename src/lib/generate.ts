import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { type AgreementInput, type AgreementType, filename, templateValues } from './agreement';

const templates = new Map<AgreementType, Promise<Buffer>>();
function loadTemplate(type: AgreementType) {
  let template = templates.get(type);
  if (!template) {
    template = readFile(path.join(process.cwd(), 'templates', `${type}.docx`));
    templates.set(type, template);
    template.catch(() => templates.delete(type));
  }
  return template;
}
export async function generateDocument(input: AgreementInput, type: AgreementType) {
  const zip = new PizZip(await loadTemplate(type));
  const document = new Docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true,
    nullGetter: part => { throw new Error(`Missing template value: ${part.value}`); },
  });
  document.render(templateValues(input));
  return document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
export async function generateDownload(input: AgreementInput) {
  if (input.agreements.length === 1) {
    const type = input.agreements[0];
    return { buffer: await generateDocument(input, type), name: filename(input, type), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  const archive = new PizZip();
  for (const type of input.agreements) archive.file(filename(input, type), await generateDocument(input, type));
  return { buffer: archive.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), name: filename(input, 'agreements'), contentType: 'application/zip' };
}
