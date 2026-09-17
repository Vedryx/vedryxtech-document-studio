/** Creates the DDA template from its reviewed text. No client data is embedded.
 * Design: standard_business_brief, customer_pack opening; brand_blue override.
 * Letter, 1-inch margins; Calibri 11pt/1.1; H1 16pt/16pt before/8pt after.
 */
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
import { signatureParagraphXml } from '../src/lib/signatures.mjs';
const content = JSON.parse(await fs.readFile('src/data/dda.json', 'utf8'));
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const paragraphs = content.map((p, index) => {
  if (p.signature) return signatureParagraphXml(p);
  const style = index === 0 ? 'Title' : p.heading ? 'Heading1' : 'Normal';
  const signatureLine = /^(Authorized signatory:|Title:)/.test(p.text);
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${signatureLine ? '<w:keepNext/>' : ''}</w:pPr><w:r><w:t xml:space="preserve">${escape(p.text)}</w:t></w:r></w:p>`;
}).join('');
const zip = new PizZip();
zip.file('[Content_Types].xml', `${prefix}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
zip.file('_rels/.rels', `${prefix}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
zip.file('docProps/core.xml', `${prefix}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>vedryxTech Data Protection &amp; Restricted Disclosure Agreement</dc:title><dc:creator>vedryxTech</dc:creator><cp:lastModifiedBy>vedryxTech</cp:lastModifiedBy></cp:coreProperties>`);
zip.file('word/document.xml', `${prefix}<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${paragraphs}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
zip.file('word/styles.xml', `${prefix}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="172038"/><w:sz w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="120" w:line="264" w:lineRule="auto"/><w:widowControl/><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="240" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="172038"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/><w:spacing w:before="320" w:after="160" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1F5FFF"/></w:rPr></w:style></w:styles>`);
zip.file('word/_rels/document.xml.rels', `${prefix}<Relationships xmlns="${PKG}"><Relationship Id="rIdStyles" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rIdHeader" Type="${R}/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="${R}/footer" Target="footer1.xml"/></Relationships>`);
const brandedTemplate = new PizZip(await fs.readFile('templates/nda.docx'));
zip.file('word/header1.xml', brandedTemplate.file('word/header1.xml').asText().replace(/<w:pBdr>.*?<\/w:pBdr>/g, ''));
zip.file('word/_rels/header1.xml.rels', brandedTemplate.file('word/_rels/header1.xml.rels').asText());
zip.file('word/footer1.xml', brandedTemplate.file('word/footer1.xml').asText());
zip.file('word/media/vedryxtech-logo.png', await fs.readFile('public/brand/logo.png'));
await fs.writeFile('templates/dda.docx', zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`DDA: ${content.length} paragraphs; ${content.map(p => p.text).join(' ').split(/\s+/).length} words; branded template created.`);
