/** One-time, reproducible branding migration. Original files are never modified.
 * Usage: node scripts/prepare-templates.mjs <msa.docx> <nda.docx>
 */
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import sharp from 'sharp';
import { normalizeSignatures } from './signature-template.mjs';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parser = new DOMParser();
const serializer = new XMLSerializer();
const replacements = [
  ['Apptware Solutions LLP', '{providerName}'],
  ['Apptware', '{providerName}'],
  ['910, Maruti Millenium Tower, NH4, Baner, Pune, Maharashtra, India - 411045', '{providerAddress}'],
  ['registered in Pune with address at', 'with registered address at'],
  ['Sales Reportage', '{companyAddress}'],
  ['Raportage', '{companyFullName}'],
  ['Harish Rohokale', '{providerSignatory}'],
  ['Founder and CEO', '{providerDesignation}'],
  ['Sales Manager', '{clientDesignation}'],
  ['Hasan', '{clientName}'],
  ['14/09/2026', '{effectiveDate}'],
];
// Replace across split Word runs while preserving all unaffected formatting.
function replaceInParagraph(paragraph, search, replacement) {
  const nodes = Array.from(paragraph.getElementsByTagNameNS(WORD, 't'));
  let combined = nodes.map(n => n.textContent).join('');
  let offset = combined.lastIndexOf(search);
  while (offset >= 0) {
    let position = 0;
    const end = offset + search.length;
    for (const node of nodes) {
      const original = node.textContent || '';
      const start = position;
      position += original.length;
      if (position <= offset || start >= end) continue;
      const before = original.slice(0, Math.max(0, offset - start));
      const after = original.slice(Math.min(original.length, end - start));
      node.textContent = before + (offset >= start ? replacement : '') + after;
      node.setAttribute('xml:space', 'preserve');
    }
    combined = nodes.map(n => n.textContent).join('');
    offset = combined.lastIndexOf(search, offset - 1);
  }
}
const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${WORD}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="1F5FFF"/></w:pBdr></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="2011680" cy="401182"/><wp:docPr id="1" name="vedryxTech logo" descr="vedryxTech"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="vedryxTech logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2011680" cy="401182"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>`;
const headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/vedryxtech-logo.png"/></Relationships>`;
const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${WORD}"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">vedryxTech  ·  </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`;
const logo = await sharp('public/brand/logo.svg').resize({ width: 1200 }).png().toBuffer();
await fs.writeFile('public/brand/logo.png', logo);
const previews = {};
for (const [type, source] of [['msa', process.argv[2]], ['nda', process.argv[3]]]) {
  if (!source) throw new Error('Pass both original MSA and NDA paths.');
  const zip = new PizZip(await fs.readFile(source));
  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d+\.xml$/.test(name)) {
      zip.file(name, header);
      zip.file(name.replace('word/', 'word/_rels/') + '.rels', headerRels);
    } else if (/^word\/footer\d+\.xml$/.test(name)) {
      zip.file(name, footer);
      zip.remove(name.replace('word/', 'word/_rels/') + '.rels');
    } else if (/^word\/.*\.xml$/.test(name)) {
      const dom = parser.parseFromString(zip.file(name).asText(), 'application/xml');
      for (const paragraph of Array.from(dom.getElementsByTagNameNS(WORD, 'p'))) {
        for (const [search, replacement] of replacements) replaceInParagraph(paragraph, search, replacement);
      }
      zip.file(name, serializer.serializeToString(dom));
    }
  }
  // All source media belongs to the old letterhead/watermark. None is in body.
  normalizeSignatures(zip);
  const body = zip.file('word/document.xml').asText();
  if (/<(?:w:drawing|w:pict)/.test(body)) throw new Error('Inspect body images before removing original media.');
  for (const name of Object.keys(zip.files)) if (name.startsWith('word/media/')) zip.remove(name);
  zip.file('word/media/vedryxtech-logo.png', logo);
  zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>vedryxTech Agreement</dc:title><dc:creator>vedryxTech</dc:creator><cp:lastModifiedBy>vedryxTech</cp:lastModifiedBy></cp:coreProperties>');
  // Remove inherited custom metadata without leaving dangling package references.
  zip.remove('docProps/custom.xml');
  for (const name of ['[Content_Types].xml', '_rels/.rels']) {
    const dom = parser.parseFromString(zip.file(name).asText(), 'application/xml');
    for (const node of Array.from(dom.documentElement.childNodes)) {
      if (node.nodeType === 1 && (node.getAttribute('PartName') === '/docProps/custom.xml' || node.getAttribute('Target') === 'docProps/custom.xml')) node.parentNode.removeChild(node);
    }
    zip.file(name, serializer.serializeToString(dom));
  }
  for (const name of Object.keys(zip.files)) {
    if (/\.(xml|rels)$/.test(name) && /apptware|harish|rohokale|raportage|Sales Reportage/i.test(zip.file(name).asText())) throw new Error(`Old identity remains in ${name}`);
  }
  const dom = parser.parseFromString(body, 'application/xml');
  previews[type] = Array.from(dom.getElementsByTagNameNS(WORD, 'p')).map(p => ({
    text: Array.from(p.getElementsByTagNameNS(WORD, 't')).map(n => n.textContent).join(''),
    heading: Array.from(p.getElementsByTagNameNS(WORD, 't')).map(n => n.textContent).join('').trim().length < 90 && p.getElementsByTagNameNS(WORD, 'b').length > 0,
  })).filter(p => p.text.trim());
  const signingStart = previews[type].findIndex(p => p.text === 'For {providerName}');
  const roles = ['party', 'name', 'title', 'sign', 'date'];
  previews[type].slice(signingStart).forEach((p, index) => { p.signature = roles[index % 5]; p.heading = p.signature === 'party'; });
  await fs.writeFile(`templates/${type}.docx`, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`${type.toUpperCase()}: rebranded; ${previews[type].length} paragraphs retained.`);
}
await fs.writeFile('src/data/preview.json', JSON.stringify(previews, null, 2) + '\n');
