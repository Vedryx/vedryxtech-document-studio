import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';
import { agreementSchema, type AgreementInput } from '../src/lib/agreement';
import { generateDocument, generateDownload } from '../src/lib/generate';
import { POST } from '../src/app/api/documents/route';
import originalPreview from '../src/data/preview.json';
import { emptySow, sowParagraphs, minorUnits, platformTotal, type SowInput } from '../src/lib/sow';
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
for (const type of ['nda', 'msa', 'dda'] as const) {
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
    const values: Record<string, string> = { ...sample, sow: '', agreements: '', providerName: 'vedryxTech', effectiveDate: '14/09/2026' };
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

const sow: SowInput = { ...emptySow, project: 'Voice agent & CRM {pilot}', scope: 'Outbound voice workflows <approved>.\nCRM integration.', deliverables: 'Agent deployment; client UAT sign-off.', timeline: '4 weeks after receipt of CRM access.', visitDefinition: 'Completed visit verified in the CRM, excluding cancellations.', rates: { ...emptySow.rates, minute: '2.50', visit: '500', platform: '5000' } };
test('SOW matches preview, escapes user content, retains logo and excludes omitted or inactive rates', async () => {
  for (const currency of ['INR', 'USD', 'AED'] as const) {
    for (const model of ['A', 'B'] as const) {
      const input = agreementSchema.parse({ ...sample, agreements: ['sow'], sow: { ...sow, currency, model } });
      const zip = new PizZip(await generateDocument(input, 'sow'));
      const xml = zip.file('word/document.xml')!.asText();
      assert.deepEqual(paragraphs(xml), sowParagraphs(input).map(p => p.text.replaceAll('\n', '')));
      assert.equal(zip.file(/word\/media\//).length, 1);
      for (const [name, file] of Object.entries(zip.files)) if (/\.(xml|rels)$/.test(name)) parser.parseFromString(file.asText(), 'application/xml');
      const text = paragraphs(xml).join('\n');
      assert.doesNotMatch(text, /Team callbacks|WhatsApp messages|Email messages|Apptware/i);
      assert.match(text, new RegExp(currency + ' 500.00 per site visit'));
      if (model === 'A') { assert.match(text, /Voice calling/); assert.doesNotMatch(text, /Platform fee|waiver/); }
      else { assert.doesNotMatch(text, /Voice calling/); assert.match(text, /platform fee is waived/); }
    }
  }
});
test('SOW validation is conditional and rejects invalid or missing commercial terms', () => {
  assert.equal(agreementSchema.safeParse(sample).success, true);
  assert.equal(agreementSchema.safeParse({ ...sample, agreements: ['sow'] }).success, false);
  for (const invalid of [{ rates: emptySow.rates }, { scope: '' }, { visitDefinition: '' }, { currency: 'EUR' }, { model: 'C' }, { rates: { ...sow.rates, minute: '-2' } }, { rates: { ...sow.rates, minute: '1.001' } }, { rates: { ...sow.rates, visit: '1e3' } }, { rates: { ...sow.rates, visit: 'Infinity' } }, { scope: '\u0000' }]) assert.equal(agreementSchema.safeParse({ ...sample, agreements: ['sow'], sow: { ...sow, ...invalid } }).success, false);
  assert.equal(sowParagraphs({ ...sample, sow: { ...sow, rates: { ...sow.rates, callback: '0.00' } } }).some(p => p.text.includes('Team callbacks')), false);
});
test('platform waiver uses exact minor units below, at and above threshold', () => {
  assert.equal(minorUnits('2.55'), 255);
  assert.equal(platformTotal(500000, 0), 500000);
  assert.equal(platformTotal(500000, 250000), 750000);
  assert.equal(platformTotal(500000, 500000), 500000);
  assert.equal(platformTotal(500000, 550000), 550000);
  assert.equal(platformTotal(255, 254), 509);
  assert.equal(platformTotal(255, 255), 255);
});
test('API downloads an SOW alone and all four agreements together', async () => {
  for (const agreements of [['sow'], ['nda', 'msa', 'dda', 'sow']]) {
    const response = await POST(request(JSON.stringify({ ...sample, agreements, sow })));
    assert.equal(response.status, 200);
    const zip = new PizZip(Buffer.from(await response.arrayBuffer()));
    if (agreements.length === 1) assert.ok(zip.file('word/document.xml'));
    else assert.equal(zip.file(/\.docx$/).length, 4);
  }
});

test('all agreements keep each party in a separate, vertically stacked signing block', async () => {
  const input: AgreementInput = { ...sample, providerSignatory: 'Provider representative with a deliberately long name', clientName: 'Client representative with another deliberately long name', sow };
  for (const type of ['nda', 'msa', 'dda', 'sow'] as const) {
    const xml = new PizZip(await generateDocument(input, type)).file('word/document.xml')!.asText();
    const dom = parser.parseFromString(xml, 'application/xml');
    const nodes = Array.from(dom.getElementsByTagNameNS(word, 'p')).filter(p => p.textContent?.trim());
    const blocks = nodes.slice(-10);
    assert.deepEqual(blocks.map(p => p.textContent), [
      'For vedryxTech', `Authorized signatory: ${input.providerSignatory}`, `Title: ${input.providerDesignation}`, 'Signature: ______________________________', 'Date signed: ____________________________',
      `For ${input.companyFullName}`, `Authorized signatory: ${input.clientName}`, `Title: ${input.clientDesignation}`, 'Signature: ______________________________', 'Date signed: ____________________________',
    ], type);
    for (const [index, p] of blocks.entries()) {
      assert.equal(p.parentNode?.nodeName, 'w:body', 'Signing paragraphs must not be in side-by-side table cells');
      assert.equal(p.getElementsByTagNameNS(word, 'tab').length, 0, 'No tab-based signature alignment');
      assert.equal(p.getElementsByTagNameNS(word, 'jc')[0].getAttribute('w:val'), 'left');
      assert.equal(p.getElementsByTagNameNS(word, 'keepNext')[0].getAttribute('w:val'), index % 5 === 4 ? '0' : '1', 'Keep each party together, allow a break between parties');
      assert.equal(p.getElementsByTagNameNS(word, 'keepLines').length, 1);
    }
  }
});
