import { z } from 'zod';
export const BRAND = 'vedryxTech';
export const agreementTypes = ['nda', 'msa', 'dda'] as const;
export type AgreementType = typeof agreementTypes[number];
export const agreementLabels: Record<AgreementType, string> = {
  nda: 'Mutual Non-Disclosure Agreement', msa: 'Master Services Agreement',
  dda: 'Data Protection & Restricted Disclosure Agreement',
};
export const agreementDescriptions: Record<AgreementType, { short: string; purpose: string; kicker: string }> = {
  nda: { short: 'Mutual non-disclosure', purpose: 'Protect shared information', kicker: 'CONFIDENTIALITY & TRUST' },
  msa: { short: 'Master services', purpose: 'Define your working relationship', kicker: 'SERVICES & COLLABORATION' },
  dda: { short: 'Data protection', purpose: 'Limit access to lead data', kicker: 'LEAD DATA & RESTRICTED ACCESS' },
};
// Reject characters forbidden by XML 1.0; docxtemplater escapes ordinary XML characters.
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`).refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(v), `${label} contains unsupported characters`);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid effective date').refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2199;
}, 'Choose a valid date between 1900 and 2199');
export const agreementSchema = z.object({
  companyFullName: text('Client legal entity name', 180),
  companyAddress: text('Client registered address', 600),
  clientName: text('Client signatory name', 120),
  clientDesignation: text('Client signatory title', 120),
  providerAddress: text('vedryxTech registered address', 600),
  providerSignatory: text('vedryxTech signatory name', 120),
  providerDesignation: text('vedryxTech signatory title', 120),
  effectiveDate: date,
  agreements: z.array(z.enum(agreementTypes)).min(1, 'Select at least one agreement').max(agreementTypes.length).refine(v => new Set(v).size === v.length, 'Select each agreement only once'),
});
export type AgreementInput = z.infer<typeof agreementSchema>;
export type FieldName = Exclude<keyof AgreementInput, 'agreements'>;
export function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
export function templateValues(input: AgreementInput) {
  return { ...input, providerName: BRAND, effectiveDate: formatDate(input.effectiveDate) };
}
export function filename(input: AgreementInput, type: AgreementType | 'agreements') {
  const client = input.companyFullName.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'client';
  return `vedryxTech-${type.toUpperCase()}-${client}-${input.effectiveDate}.${type === 'agreements' ? 'zip' : 'docx'}`;
}
