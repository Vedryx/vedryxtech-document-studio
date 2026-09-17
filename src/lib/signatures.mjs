/** Shared stacked signing blocks for Word documents and live previews. */
export function signatureParagraphs(values = {}) {
  const defaults = { providerName: '{providerName}', providerSignatory: '{providerSignatory}', providerDesignation: '{providerDesignation}', companyFullName: '{companyFullName}', clientName: '{clientName}', clientDesignation: '{clientDesignation}' };
  const v = { ...defaults, ...values };
  return [
    [v.providerName, v.providerSignatory, v.providerDesignation],
    [v.companyFullName, v.clientName, v.clientDesignation],
  ].flatMap(([party, name, title]) => [
    { text: `For ${party}`, heading: true, signature: 'party' },
    { text: `Authorized signatory: ${name}`, heading: false, signature: 'name' },
    { text: `Title: ${title}`, heading: false, signature: 'title' },
    { text: 'Signature: ______________________________', heading: false, signature: 'sign' },
    { text: 'Date signed: ____________________________', heading: false, signature: 'date' },
  ]);
}

/** @param {{text: string, signature?: string}} paragraph */
export function signatureParagraphXml(paragraph) {
  const kind = paragraph.signature;
  const before = kind === 'party' || kind === 'sign' ? 360 : 0;
  const after = kind === 'date' ? 360 : 100;
  const text = paragraph.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  // Keep each party's block together, but allow a page break between parties.
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:keepNext w:val="${kind === 'date' ? 0 : 1}"/><w:keepLines/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:spacing w:before="${before}" w:after="${after}" w:line="264" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b w:val="${kind === 'party' ? 1 : 0}"/><w:color w:val="${kind === 'party' ? '1F5FFF' : '172038'}"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}
