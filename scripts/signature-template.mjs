import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { signatureParagraphs, signatureParagraphXml } from '../src/lib/signatures.mjs';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export function normalizeSignatures(zip) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(zip.file('word/document.xml').asText(), 'application/xml');
  const body = dom.getElementsByTagNameNS(W, 'body')[0];
  const nodes = Array.from(body.childNodes);
  const start = nodes.findIndex(node => node.localName === 'p' && /^(Company: \{providerName\}|For \{providerName\})/.test(node.textContent.trim()));
  if (start < 0) throw new Error('Could not locate the provider signature block');
  const section = nodes.find(node => node.localName === 'sectPr');
  if (!section) throw new Error('Missing document section settings');
  for (const node of nodes.slice(start)) if (node !== section) body.removeChild(node);
  const fragment = parser.parseFromString(`<w:body xmlns:w="${W}">${signatureParagraphs().map(signatureParagraphXml).join('')}</w:body>`, 'application/xml');
  for (const node of Array.from(fragment.documentElement.childNodes)) body.insertBefore(dom.importNode(node, true), section);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(dom));
}
