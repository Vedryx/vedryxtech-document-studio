'use client';
import { activeRates, emptySow, minorUnits, money, platformTotal, rateLabels, rateUnits, type RateKey, type SowInput } from '@/lib/sow';
import { useState } from 'react';

export default function SowEditor({ value = emptySow, onChange, errors }: { value?: SowInput; onChange: (value: SowInput) => void; errors?: string[] }) {
  const [visits, setVisits] = useState('10');
  const update = (patch: Partial<SowInput>) => onChange({ ...value, ...patch });
  const keys: RateKey[] = value.model === 'A' ? ['minute', 'callback', 'whatsapp', 'email', 'visit'] : ['platform', 'visit'];
  const platform = minorUnits(value.rates.platform);
  const visitTotal = minorUnits(value.rates.visit) * Number(visits || 0);
  function field(key: 'project' | 'scope' | 'deliverables' | 'timeline' | 'paymentTerms' | 'visitDefinition', label: string, placeholder: string, multiline = true) {
    const props = { id: `sow-${key}`, value: value[key], placeholder, maxLength: 2000, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [key]: e.target.value }) };
    return <div className="field"><label htmlFor={props.id}>{label} <span>*</span></label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</div>;
  }
  return <section className="form-card sow-editor" id="sow" tabIndex={-1} aria-labelledby="sow-heading">
    <div className="section-heading"><div className="step-number">04</div><div><h2 id="sow-heading">SOW & payment structure</h2><p>Choose pricing, then enter the agreed charges.</p></div></div>
    <fieldset className="pricing-model"><legend>Payment option</legend>{(['A', 'B'] as const).map(model => <label key={model} className={value.model === model ? 'selected' : ''}><input type="radio" name="pricing-model" value={model} checked={value.model === model} onChange={() => update({ model })} /><strong>Option {model}</strong><span>{model === 'A' ? 'Usage-based charges' : 'Platform fee + site visits'}</span></label>)}</fieldset>
    <div className="field"><label htmlFor="sow-currency">Currency</label><select id="sow-currency" value={value.currency} onChange={e => update({ currency: e.target.value as SowInput['currency'] })}><option value="INR">INR — Indian rupee</option><option value="USD">USD — US dollar</option><option value="AED">AED — UAE dirham</option></select></div>
    <p className="field-hint">Enter only agreed charges. Blank or zero amounts are omitted from the SOW. Switching options excludes the other option’s charges.</p>
    <div className="sow-rates">{keys.map(key => <div className="field" key={key}><label htmlFor={`rate-${key}`}>{rateLabels[key]}</label><div className="rate-input"><span>{value.currency}</span><input id={`rate-${key}`} type="number" min="0" max="999999999.99" step="0.01" inputMode="decimal" placeholder="Not included" value={value.rates[key]} onChange={e => update({ rates: { ...value.rates, [key]: e.target.value } })} /></div><p className="field-hint">{rateUnits[key]}</p></div>)}</div>
    {value.model === 'B' && platform > 0 && minorUnits(value.rates.visit) > 0 && <div className="sow-calculator"><strong>Platform-fee waiver</strong><p>Below the platform fee: platform fee + visit charges. At or above it: only visit charges.</p><label htmlFor="example-visits">Example site visits <span>(preview only)</span></label><input id="example-visits" type="number" min="0" max="10000" step="1" value={visits} onChange={e => { if (/^\d{0,5}$/.test(e.target.value) && Number(e.target.value) <= 10000) setVisits(e.target.value); }} /><p>{money(visitTotal, value.currency)} in site visits {visitTotal >= platform ? '· platform fee waived' : `+ ${money(platform, value.currency)} platform fee`}</p><strong>Total: {money(platformTotal(platform, visitTotal), value.currency)} before taxes</strong></div>}
    {activeRates(value).includes('visit') && field('visitDefinition', 'What counts as a billable site visit?', 'e.g. A completed visit confirmed in the client CRM; duplicates and cancellations excluded.')}
    {field('paymentTerms', 'Invoicing & payment terms', 'Billing period, payment due date, taxes and any advance or milestone payments.')}
    {field('project', 'Project name', 'e.g. Reportage AI voice-agent project', false)}
    {field('scope', 'Scope of services', 'Calling workflows, integrations, languages and any exclusions.')}
    {field('deliverables', 'Deliverables & acceptance criteria', 'What will be delivered, how the client will review it and when acceptance is due.')}
    {field('timeline', 'Timeline & dependencies', 'Start date, milestones, duration and client inputs required.')}
    {errors && <div className="field-error" role="alert">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
  </section>;
}
