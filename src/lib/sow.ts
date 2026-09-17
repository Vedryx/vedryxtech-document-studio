import { z } from 'zod';
import { signatureParagraphs } from './signatures.mjs';

export const rateLabels = { minute: 'Voice calling', callback: 'Team callbacks', whatsapp: 'WhatsApp messages', email: 'Email messages', visit: 'Site visits', platform: 'Platform fee' } as const;
export type RateKey = keyof typeof rateLabels;
export const rateUnits: Record<RateKey, string> = { minute: 'per minute', callback: 'per callback', whatsapp: 'per message', email: 'per message', visit: 'per site visit', platform: 'per billing period' };
const safeText = z.string().trim().max(2000).refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(v), 'Unsupported characters');
// Store decimal input as text: blank stays blank and currency arithmetic uses minor units.
const rate = z.string().regex(/^(?:\d{1,9}(?:\.\d{1,2})?)?$/, 'Enter a positive amount with up to 2 decimal places');
export const sowSchema = z.object({
  model: z.enum(['A', 'B']), currency: z.enum(['INR', 'USD', 'AED']),
  project: safeText.min(1, 'Enter the project name'), scope: safeText.min(1, 'Enter the scope'),
  deliverables: safeText.min(1, 'Enter deliverables'), timeline: safeText.min(1, 'Enter the timeline'),
  paymentTerms: safeText.min(1, 'Enter payment terms'), visitDefinition: safeText,
  rates: z.object({ minute: rate, callback: rate, whatsapp: rate, email: rate, visit: rate, platform: rate }),
}).superRefine((sow, ctx) => {
  if (!activeRates(sow).length) ctx.addIssue({ code: 'custom', path: ['rates'], message: 'Enter at least one charge greater than zero' });
  if (minorUnits(sow.rates.visit) > 0 && !sow.visitDefinition) ctx.addIssue({ code: 'custom', path: ['visitDefinition'], message: 'Define a billable site visit' });
});
export type SowInput = z.infer<typeof sowSchema>;
export const emptySow: SowInput = {
  model: 'A', currency: 'INR', project: '', scope: '', deliverables: '', timeline: '',
  paymentTerms: 'Invoiced monthly in arrears. Payment is due within 15 calendar days of receipt of an accurate invoice. Applicable taxes are additional.',
  visitDefinition: '', rates: { minute: '', callback: '', whatsapp: '', email: '', visit: '', platform: '' },
};
export function minorUnits(value: string) { if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return 0; const [whole, fraction = ''] = value.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0')); }
export function activeRates(sow: SowInput): RateKey[] { return (sow.model === 'A' ? ['minute', 'callback', 'whatsapp', 'email', 'visit'] as RateKey[] : ['platform', 'visit'] as RateKey[]).filter(key => minorUnits(sow.rates[key]) > 0); }
export function money(amount: number, currency: SowInput['currency']) { return `${currency} ${new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100)}`; }
export function platformTotal(platform: number, visits: number) { return visits >= platform ? visits : platform + visits; }
type Parties = { companyFullName: string; companyAddress: string; clientName: string; clientDesignation: string; providerAddress: string; providerSignatory: string; providerDesignation: string; effectiveDate: string; sow?: SowInput };
export function sowParagraphs(input: Parties): { text: string; heading: boolean; signature?: string }[] {
  const sow = input.sow ?? emptySow;
  const value = (text: string, label: string) => text || `[${label}]`;
  const p = (text: string, heading = false) => ({ text, heading });
  const date = input.effectiveDate ? input.effectiveDate.split('-').reverse().join('/') : '[Effective date]';
  const rows = activeRates(sow);
  const paragraphs = [p('Statement of Work', true), p(`Project: ${value(sow.project, 'Project name')}`), p(`Effective date: ${date}`), p('Parties and governing agreement', true), p(`This Statement of Work (SOW) is between vedryxTech, at ${value(input.providerAddress, 'Provider address')}, and ${value(input.companyFullName, 'Client legal entity')}, at ${value(input.companyAddress, 'Client address')}. It incorporates the Master Services Agreement (MSA) between these parties and must be read with that agreement. Each party signs on its own behalf.`), p('Scope of services', true), p(value(sow.scope, 'Scope of services')), p('Deliverables and acceptance', true), p(value(sow.deliverables, 'Deliverables and acceptance criteria')), p('Timeline and dependencies', true), p(value(sow.timeline, 'Timeline and client dependencies')), p(`Pricing — Option ${sow.model}`, true), p(`All charges are denominated in ${sow.currency}. Rates below apply to actual billable usage or the stated billing period; they are not a commitment to a minimum usage volume.`), ...rows.map(key => p(`${rateLabels[key]}: ${money(minorUnits(sow.rates[key]), sow.currency)} ${rateUnits[key]}.`))];
  if (!rows.length) paragraphs.push(p('[Enter at least one charge]'));
  if (rows.includes('visit')) paragraphs.push(p(`Billable site visit: ${value(sow.visitDefinition, 'Define a billable site visit and how it is verified')}`));
  if (sow.model === 'B' && rows.includes('platform') && rows.includes('visit')) {
    paragraphs.push(p(`Platform-fee waiver: calculated separately for each billing period. If total site-visit charges are below ${money(minorUnits(sow.rates.platform), sow.currency)}, the platform fee plus site-visit charges are payable. When site-visit charges equal or exceed that amount, the platform fee is waived and only site-visit charges are payable. This calculation is before applicable taxes and any separately agreed charges.`));
  }
  paragraphs.push(p('Invoicing and payment', true), p(value(sow.paymentTerms, 'Billing frequency, payment due date and taxes')), p('Changes to this SOW', true), p('Changes to scope, rates or timeline require a written Change Order signed by both parties in accordance with the MSA.'), p('Signatures', true), ...signatureParagraphs({ providerName: 'vedryxTech', providerSignatory: value(input.providerSignatory, 'Provider signatory'), providerDesignation: value(input.providerDesignation, 'Provider title'), companyFullName: value(input.companyFullName, 'Client legal entity'), clientName: value(input.clientName, 'Client signatory'), clientDesignation: value(input.clientDesignation, 'Client title') }));
  return paragraphs;
}
