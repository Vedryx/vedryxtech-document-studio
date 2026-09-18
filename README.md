# vedryxTech Document Studio

A single Next.js application for preparing branded mutual NDAs, master services agreements, data-protection agreements (DDA), and statements of work (SOW). The React frontend and document-generation API run together in one Node.js service.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No database or separate backend is needed. Signed PDF generation requires the private signature environment variable below.

## Workflow

1. Select NDA, MSA, DDA, SOW, or any combination.
2. Enter the client's registered legal entity, address, signatory, and title.
3. Set the effective date. Provider details are fixed: Devendra Saini, CEO, vedryxTech; k-603, Mahindra Royale, Ajmera, Pimpri, Pune -411018.
4. For an SOW, choose pricing A/B and INR/USD/AED, enter agreed rates, then complete scope, deliverables, timeline and payment terms. Review the live text preview, then generate.
5. One agreement downloads as `.pdf`; multiple selections download together as a `.zip` containing the selected PDFs.

Downloads are available again from **Session downloads** until the page is refreshed or closed. Form values and generated files are not persisted on the server or in browser storage. The application returns binary downloads instead of public, shareable document URLs. Each party has a separate vertical signing block. Devendra Saini’s supplied signature image is embedded on the server, with the PDF generation date in Asia/Kolkata. The client’s signature and signing date remain blank. This embeds a supplied image; it is not a certificate-based digital signature.

The header's **Dark mode / Light mode** button initially follows the system theme and saves only the theme preference in local storage. It also works for the current session when browser storage is unavailable. The white document preview is intentionally unaffected. Responsive layouts cover compact phones, landscape screens, tablets and wide desktops.

## Statement of work (SOW)

SOW PDFs share the other agreements’ logo, typography, page furniture and stacked signing blocks. `src/lib/sow.ts` builds both the live preview and the exported content. Blank or zero rates are omitted; only rates for the selected pricing option appear. Positive rates are required for at least one item. INR is the default; USD and AED are also available. Rates accept up to two decimal places. Currency selection changes the denomination, not the numeric rate (no FX conversion).

- **Option A:** per-minute voice calling, team callbacks, WhatsApp messages, email messages and site visits.
- **Option B:** platform fee per billing period and site visits. When site-visit charges are below the platform fee, both are payable. When visits reach or exceed it, only site-visit charges are payable. This implements the user's literal waiver threshold, not a minimum-bill model: 5,000 platform + 500/visit means 0 visits = 5,000; 5 visits = 7,500; 10 visits = 5,000; 11 visits = 5,500, before taxes.

An on-screen quantity calculator illustrates option B; its example quantity is not written into the contract. Site-visit billing requires a definition of a qualifying visit. Editable payment terms default to monthly arrears, 15 calendar days and additional applicable taxes; review these defaults for each client. The SOW incorporates the parties' MSA and requires signed change orders. It does not rewrite the supplied MSA.

The API accepts an optional `sow` object, required and validated only when `agreements` includes `sow`. It has `model`, `currency`, `project`, `scope`, `deliverables`, `timeline`, `paymentTerms`, `visitDefinition`, and `rates` (decimal strings under `minute`, `callback`, `whatsapp`, `email`, `visit`, `platform`). Empty rate strings are allowed. Other document requests retain their existing payload format.

After updating the DDA shell branding, run `node scripts/prepare-sow.mjs` to refresh `templates/sow.docx`. The runtime fills that shell from the shared SOW content builder.

## Data-protection agreement (DDA)

The **Data Protection & Restricted Disclosure Agreement** is a new draft based on the requested lead-data safeguards. It is selectable and previewable alongside the supplied NDA/MSA. It sets implementation requirements before live lead processing; it does not certify that the calling platform currently implements them.

Its commitments cover encrypted number storage, separate key management, no routine staff access to readable numbers without specific prior Client written request/approval, opaque lead references for the AI agent, temporary number access inside the dialing service, no durable plaintext number storage in the Provider's systems, and limited use of lead names. It also addresses incidental spoken numbers, logs and callbacks, approved telephony/AI providers, retention and deletion, breach notification, and the narrow exception for legally compelled disclosure. Recordings and retained transcripts need separate approval.

Before real lead processing, the Parties must agree an operating schedule covering authorized campaigns and fields, access approvers, vendors and locations, retention/backup periods, and verified safeguards. This project is a document generator: it does not implement or audit a phone-number vault, AI calling service, telephony integration, or secure-memory controls.

The DDA is a focused draft for legal and technical review, not a representation of complete compliance with every applicable data-protection or telemarketing rule. The executed MSA and applicable jurisdiction must be reviewed for consistency before signing.

Text source: `src/data/dda.json`. Rebuild its Word template after text changes:

```sh
node scripts/prepare-dda.mjs
```

Technical reference: [Twilio Call resource](https://www.twilio.com/docs/voice/api/call-resource) documents destination-number handling and call records. Twilio is an illustrative reference, not a selected vendor. Legal review reference: [UAE Federal Decree-Law No. 45 of 2021](https://www.uaelegislation.gov.ae/en/legislations/1972/download), particularly processing instructions, security and retention obligations; applicability needs confirmation for the actual entities and processing locations.

## Branding and templates

- Company name: **vedryxTech**, including body text, signatures, document properties, and footers.
- Selected logo: the supplied **primary** SVG, with dark lettering and blue accents on white. The app uses SVG; Word embeds a high-resolution PNG.
- The supplied MSA and NDA were adapted with their agreement wording and body formatting retained. Old headers, footers, watermark images, company identity, address, and signatory defaults were replaced.
- Addresses and signatories are required inputs. No guessed registered address or signatory is inserted.
- The original India/Pune legal provisions, MSA non-compete, IP and liability clauses, and NDA duration clauses remain in the templates. This branding migration does not revise their substance.
- All previews contain the corresponding agreement body text. PDF exports use the same clauses, with embedded fonts, the logo on every page, page numbers and a server-applied provider signature. The preview describes the applied signature without serving its source image to the browser.

Prepared templates are included in `templates/`. Generation does not depend on files in the author's Downloads folder. To repeat the migration from originals:

```sh
node scripts/prepare-templates.mjs /path/to/original-msa.docx /path/to/original-nda.docx
```

This updates the original two templates, their preview JSON, and the PNG logo. It leaves the source files untouched. Run `node scripts/prepare-dda.mjs` afterwards to refresh the DDA with the current branding. Review updated documents after changing templates. To upgrade existing prepared NDA/MSA/DDA signature blocks without reimporting originals, run `node scripts/prepare-signatures.mjs`. Shared signing text and Word layout live in `src/lib/signatures.mjs`.

## Application structure

```text
src/app/page.tsx                 Main page
src/components/document-studio.tsx  Form, preview, session downloads
src/app/api/documents/route.ts  Validated POST API; returns PDF or ZIP
src/app/api/health/route.ts     Health endpoint
src/lib/agreement.ts           Shared validation, types, filenames
src/lib/generate.ts            PDF download packaging and legacy Word helpers
src/data/preview.json          Preview text extracted from prepared templates
src/data/dda.json              DDA draft text shared with the Word template builder
src/components/theme-toggle.tsx  Persistent light/dark theme selection
templates/                    Branded Word templates
public/brand/                 Supplied logo assets
```

### POST /api/documents

Content type: `application/json`. Required fields:

```json
{
  "companyFullName": "Example Properties LLC",
  "companyAddress": "Example client registered address",
  "clientName": "Alex Example",
  "clientDesignation": "Director",
  "effectiveDate": "2026-09-14",
  "agreements": ["nda", "msa", "dda"]
}
```

The API validates real dates, required fields, length limits and document types; escapes XML text; limits the request body to 16 KiB; and returns `Cache-Control: no-store`. Invalid requests receive a structured 400 response, unsupported content types 415, oversized requests 413, and generation errors 500. It does not log submitted client details.

## Production

Vercel is configured by `vercel.json`. The Next.js route streams PDF downloads so multi-file ZIPs are not constrained by Vercel's 4.5 MB buffered-response limit. Templates are included using `outputFileTracingIncludes`; the private signature must be configured as described below.

```sh
vercel --prod
```

```sh
npm run build
npm start
```

`Dockerfile` provides a single Node.js deployment; `render.yaml` configures a Render web service and `/api/health` health check. Templates are traced into the standalone build and explicitly copied into Docker. Do not deploy as a static export: generation requires the Node.js server.

```sh
docker build -t vedryxtech-document-studio .
docker run --rm -p 3000:3000 vedryxtech-document-studio
```

This version has no sign-in or access-control layer. Use a private/internal deployment or add access control before making an internal workspace public. There is no document storage or e-signature integration.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Tests cover all four document types, metadata and branding, XML escaping, preview consistency, mixed document bundles, request validation, error handling, theme persistence/system preference/blocked storage, and desktop/mobile workflows across widths from 320 to 1920 pixels. Test data is fictional.

Representative signed NDA, MSA, DDA and SOW PDFs were rendered with Poppler and visually inspected. Tests verify complete clause text, fixed provider identity, one provider signature image, and separate signing blocks kept together on each page.

## Source reference

The original frontend was reviewed at https://github.com/devwithsmile/apptwareDocsGenerator (main). It called an external `/generate-doc` service; the backend and document templates were not included in that repository. This project implements generation locally in Next.js using the supplied Word files.

## Private signature configuration

Set `PROVIDER_SIGNATURE_BASE64` to the base64 contents of the provider’s PNG signature. For local development, store it in `.env.local` (ignored by Git and Vercel uploads). In Vercel, use a **sensitive Production environment variable**, then redeploy. Never use a `NEXT_PUBLIC_` variable, place the image in `public/`, or commit the image or signed QA samples.

A helper uploads a local PNG to the linked project without passing the image through CLI arguments or printing it:

```sh
node scripts/configure-signature.mjs /private/path/signature.png
```

Generation fails if the signature is missing or invalid, rather than silently returning an unsigned agreement. The provider identity is fixed by server validation, including when the request omits or attempts to override the old provider fields. The existing public document-generation endpoint produces signed PDFs on demand; the source PNG is not exposed as a separate asset. Tests use the public logo as a stand-in signature, never the real signature.

`src/lib/generate-pdf.ts` renders PDFs directly from canonical agreement text using PDFKit and bundled OFL Noto Sans fonts. LibreOffice and external conversion services are not required in production. Original Word templates remain internal reference artifacts; the application now exports PDFs exclusively. `pdfjs-dist` tests check text preservation, provider identity, image counts, empty pages and page boundaries.
