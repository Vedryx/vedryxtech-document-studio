import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { type AgreementInput, type AgreementType, filename, templateValues } from './agreement';

import { sowParagraphs } from './sow';

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
  if (type === 'sow') {
    const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const paragraphs = sowParagraphs(input).map((p, index) => `<w:p><w:pPr><w:pStyle w:val="${index === 0 ? 'Title' : p.heading ? 'Heading1' : 'Normal'}"/>${/^(For |Authorized signatory:|Title:)/.test(p.text) ? '<w:keepNext/>' : ''}</w:pPr><w:r>${p.text.split('\n').map(line => `<w:t xml:space="preserve">${escape(line)}</w:t>`).join('<w:br/>')}</w:r></w:p>`).join('');
    const xml = document.getZip().file('word/document.xml')!.asText();
    document.getZip().file('word/document.xml', xml.replace(/(<w:body>)[\s\S]*?(<w:sectPr)/, (_, start, end) => start + paragraphs + end));
  }
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
