// Reuse the branded business-brief shell; runtime creates the editable SOW body.
import fs from 'node:fs/promises';
import PizZip from 'pizzip';
const zip = new PizZip(await fs.readFile('templates/dda.docx'));
zip.file('word/document.xml', zip.file('word/document.xml').asText().replace(/(<w:body>)[\s\S]*?(<w:sectPr)/, '$1<w:p/>$2'));
zip.file('docProps/core.xml', zip.file('docProps/core.xml').asText().replace('Data Protection &amp; Restricted Disclosure Agreement', 'Statement of Work'));
await fs.writeFile('templates/sow.docx', zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
