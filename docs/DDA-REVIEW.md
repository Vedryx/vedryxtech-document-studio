# DDA drafting and implementation notes

The new DDA is a proposed agreement, not a finding that the calling system is already secure. Its obligations must be implemented and verified before live lead processing. No calling-system implementation or security audit was performed as part of adding this document to the generator.

The request is reflected as follows:

| Requested commitment | Draft treatment |
| --- | --- |
| Staff never read lead numbers unless requested or approved | Specific prior written Client request or approval, named roles, purpose, time limit, access record and revocation. Narrow legally compelled disclosure exception. |
| All stored numbers are encrypted | Encrypted number fields and copies, including backups, queues and caches; keys separated and access restricted. |
| AI reads encrypted numbers | AI uses an opaque reference; a separate dialing service resolves it. The AI does not receive a usable stored destination number or its key. |
| Number available only to dial | Temporary decryption inside the restricted dialer and disclosure to the approved telephony recipient for an authorized call. |
| No plaintext in memory or DB | No durable plaintext number storage; tightly limited transient working memory is explicitly acknowledged and controlled. Garbage collection is not treated as proof of zeroization. |
| Data is safe | Risk-reducing commitments, not an absolute security guarantee or a claim that encryption anonymizes the data. |
| May use other PII such as name | Lead name allowed only as needed for authorized calling; additional fields need documented approval and necessity. |

The agreement also handles call metadata/callbacks, incidental numbers volunteered verbally, recordings and retained transcripts, third-party record retention, deletion and backups, incident notification, and an operating schedule to be agreed before processing.

Before signing, confirm the actual contracting entities, MSA relationship and applicable law, and have the draft reviewed by qualified counsel. Before live use, confirm the vendors and their data use/retention, storage countries, approval authority, encryption/key boundary, retention and backup limits, and evidence that plaintext numbers do not leak into logs or AI context.

The source remains `src/data/dda.json`; `node scripts/prepare-dda.mjs` builds `templates/dda.docx`. The white-page Word document is unchanged by the workspace theme. Printed pagination could not be visually checked because LibreOffice is unavailable; OOXML structure and rendered text substitutions are tested.
