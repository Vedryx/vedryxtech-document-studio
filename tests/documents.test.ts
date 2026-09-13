import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';
import { agreementSchema, agreementTypes, type AgreementInput } from '../src/lib/agreement';
import { generateDocument, generateDownload } from '../src/lib/generate';
import { POST } from '../src/app/api/documents/route';
import originalPreview from '../src/data/preview.json';
import dda from '../src/data/dda.json';
const preview = { ...originalPreview, dda };
const sample: AgreementInput = {
  companyFullName: 'Example & Partners <LLC>', companyAddress: 'Client building, Dubai\nUnited Arab Emirates',
  clientName: 'Alex Example', clientDesignation: 'Director', providerAddress: 'Provider building, Dubai\nUnited Arab Emirates',
  providerSignatory: 'Dev Example', providerDesignation: 'Founder & CEO', effectiveDate: '2026-09-14', agreements: ['nda', 'msa'],
};
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parser = new DOMParser({ errorHandler: { warning: () => {}, error: message => { throw new Error(message); }, fatalError: message => { throw new Error(message); } } });
function paragraphs(xml: string) { return Array.from(parser.parseFromString(xml, 'application/xml').getElementsByTagNameNS(word, 'p')).map(p => Array.from(p.getElementsByTagNameNS(word, 't')).map(t => t.textContent).join('')).filter(p => p.trim()); }
for (const type of agreementTypes) {
  test(`${type}: valid branded DOCX, substituted values, unchanged clause text and matching preview`, async () => {
    const output = await generateDocument(sample, type);
    const zip = new PizZip(output);
    const document = zip.file('word/document.xml')!.asText();
    const text = paragraphs(document).join('\n');
    assert.ok(text.includes(sample.companyFullName));
    assert.ok(text.includes(sample.providerSignatory));
    assert.ok(text.includes('14/09/2026'));
    assert.ok(text.includes('vedryxTech'));
    assert.ok(!/\{\w+\}|undefined|null/.test(text));
    assert.equal(zip.file(/word\/media\//).length, 1);
    assert.ok(zip.file('word/media/vedryxtech-logo.png'));
    for (const [name, file] of Object.entries(zip.files)) {
      if (/\.(xml|rels)$/.test(name)) {
        assert.doesNotMatch(file.asText(), /apptware|harish|rohokale|raportage|sales reportage|maruti/i);
        parser.parseFromString(file.asText(), 'application/xml');
      }
    }
    const values: Record<string, string> = { ...sample, agreements: '', providerName: 'vedryxTech', effectiveDate: '14/09/2026' };
    const expected = preview[type].map(p => p.text.replace(/\{(\w+)\}/g, (_, key) => values[key]));
    // Word stores line breaks as w:br; the comparison strips those from the input.
    assert.deepEqual(paragraphs(document), expected.map(p => p.replaceAll('\n', '')));
    const source = new PizZip(await fs.readFile(`templates/${type}.docx`));
    assert.equal(paragraphs(source.file('word/document.xml')!.asText()).length, paragraphs(document).length);
  });
}
test('two documents download as a ZIP containing both named Word files', async () => {
  const output = await generateDownload(sample);
  assert.equal(output.contentType, 'application/zip');
  const files = new PizZip(output.buffer).file(/\.docx$/);
  assert.equal(files.length, 2);
  for (const file of files) { assert.match(file.name, /^vedryxTech-(MSA|NDA)-Example-Partners-LLC-2026-09-14.docx$/); assert.ok(new PizZip(file.asNodeBuffer()).file('word/document.xml')); }
});
test('DDA and every mixed selection produce the requested named documents', async () => {
  for (const agreements of [['dda'], ['dda', 'nda'], ['msa', 'dda'], ['nda', 'msa', 'dda']] as AgreementInput['agreements'][]) {
    assert.equal(agreementSchema.safeParse({ ...sample, agreements }).success, true);
    const response = await POST(request(JSON.stringify({ ...sample, agreements })));
    assert.equal(response.status, 200);
    const zip = new PizZip(Buffer.from(await response.arrayBuffer()));
    if (agreements.length === 1) {
      assert.match(response.headers.get('content-disposition')!, /vedryxTech-DDA-/);
      assert.ok(zip.file('word/document.xml'));
    } else {
      assert.equal(zip.file(/\.docx$/).length, agreements.length);
      for (const type of agreements) assert.equal(zip.file(new RegExp(`-${type.toUpperCase()}-.*\\.docx$`)).length, 1);
    }
  }
});
test('DDA contains the agreed access boundary, scoped PII use and implementation conditions', async () => {
  const text = paragraphs(new PizZip(await generateDocument(sample, 'dda')).file('word/document.xml')!.asText()).join('\n');
  for (const phrase of ['before the Provider imports or processes live lead data', 'only in encrypted form', 'first requested or approved that specific access in writing', 'non-revealing lead reference or token', 'isolated dialing service', 'shall not persist plaintext telephone numbers', 'may read a lead\'s name', 'separate, documented Client approval', 'not a guarantee of absolute security', 'Signature:']) assert.ok(text.includes(phrase), `Missing DDA safeguard: ${phrase}`);
  assert.doesNotMatch(text, /data is (?:completely|100%) safe|never (?:exists|stored) in memory/i);
});
test('request validation rejects missing data, empty/duplicate types, invalid dates, and XML control characters', () => {
  for (const invalid of [{ companyFullName: ' ' }, { agreements: [] }, { agreements: ['nda', 'nda'] }, { effectiveDate: '2026-02-30' }, { effectiveDate: '2026-13-01' }, { clientName: '\u0000Alex' }, { agreements: ['../../secret'] }]) assert.equal(agreementSchema.safeParse({ ...sample, ...invalid }).success, false);
  assert.equal(agreementSchema.safeParse({ ...sample, effectiveDate: '2028-02-29' }).success, true);
});
function request(body: string, contentType = 'application/json') { return new Request('http://localhost/api/documents', { method: 'POST', headers: { 'Content-Type': contentType }, body }); }
test('API returns validation errors and guards content type and request size', async () => {
  assert.equal((await POST(request('{}'))).status, 400);
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request('{}', 'text/plain'))).status, 415);
  assert.equal((await POST(request(JSON.stringify({ text: 'a'.repeat(17000) })))).status, 413);
});
test('API returns a private binary Word download for one agreement', async () => {
  const response = await POST(request(JSON.stringify({ ...sample, agreements: ['nda'] })));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition')!, /attachment; filename="vedryxTech-NDA-/);
  assert.match(response.headers.get('cache-control')!, /no-store/);
  assert.match(response.headers.get('content-type')!, /wordprocessingml/);
  assert.ok(new PizZip(Buffer.from(await response.arrayBuffer())).file('word/document.xml'));
});
