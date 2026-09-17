'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownToLine, ArrowRight, Building2, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, FileCheck2, FilePlus2, Files, FileText, FolderDown, LoaderCircle, LockKeyhole, Plus, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { agreementTypes, agreementDescriptions, agreementLabels, agreementSchema, type AgreementInput, type AgreementType, type FieldName, BRAND, filename, formatDate } from '@/lib/agreement';
import originalPreview from '@/data/preview.json';
import dda from '@/data/dda.json';
import { emptySow, sowParagraphs } from '@/lib/sow';
import SowEditor from './sow-editor';
import ThemeToggle from './theme-toggle';
const preview = { ...originalPreview, dda };

const emptyForm: AgreementInput = {
  sow: emptySow,
  companyFullName: '', companyAddress: '', clientName: '', clientDesignation: '',
  providerAddress: '', providerSignatory: '', providerDesignation: '', effectiveDate: '', agreements: ['nda', 'msa'],
};
const placeholders: Record<FieldName, string> = {
  companyFullName: 'e.g. Reportage Properties LLC', companyAddress: 'Street, building, city, country, postal code',
  clientName: 'Full name', clientDesignation: 'e.g. Sales Manager',
  providerAddress: 'vedryxTech’s registered office address', providerSignatory: 'Full name',
  providerDesignation: 'e.g. Founder & CEO', effectiveDate: '',
};
const labels: Record<FieldName, string> = {
  companyFullName: 'Client legal entity name', companyAddress: 'Client registered address',
  clientName: 'Client signatory name', clientDesignation: 'Client signatory title', providerAddress: 'vedryxTech registered address',
  providerSignatory: 'vedryxTech signatory name', providerDesignation: 'vedryxTech signatory title', effectiveDate: 'Effective date',
};
type Export = { url: string; name: string; client: string; types: AgreementType[]; time: string };
type Errors = Partial<Record<keyof AgreementInput, string[]>>;

export default function DocumentStudio() {
  const [form, setForm] = useState<AgreementInput>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [activeTab, setActiveTab] = useState<AgreementType>('nda');
  const [view, setView] = useState<'create' | 'exports'>('create');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [exports, setExports] = useState<Export[]>([]);
  const [help, setHelp] = useState(false);
  const urls = useRef<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const noticeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const objectUrls = urls.current;
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Resolve the browser's local date after hydration; the server may be in another timezone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(current => ({ ...current, effectiveDate: localDate }));
    return () => { objectUrls.forEach(url => URL.revokeObjectURL(url)); if (noticeRef.current) clearTimeout(noticeRef.current); };
  }, []);
  useEffect(() => {
    if (help) helpRef.current?.showModal();
    else helpRef.current?.close();
  }, [help]);
  const completed = Object.keys(labels).filter(key => form[key as FieldName].trim()).length;
  const progress = Math.round(completed / Object.keys(labels).length * 100);
  function notify(message: string) {
    setNotice(message);
    if (noticeRef.current) clearTimeout(noticeRef.current);
    noticeRef.current = setTimeout(() => setNotice(''), 6000);
  }
  function update(name: FieldName, value: string) {
    setForm(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
  }
  function toggle(type: AgreementType) {
    setForm(current => ({ ...current, agreements: current.agreements.includes(type) ? current.agreements.filter(t => t !== type) : [...current.agreements, type] }));
    setErrors(current => ({ ...current, agreements: undefined }));
    setActiveTab(type);
  }
  function field(name: FieldName, multiline = false, hint?: string) {
    const props = {
      id: name, name, value: form[name], placeholder: placeholders[name], required: true,
      maxLength: multiline ? 600 : name === 'companyFullName' ? 180 : 120,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(name, event.target.value),
      'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : hint ? `${name}-hint` : undefined,
    };
    return <div className="field"><label htmlFor={name}>{labels[name]} <span aria-hidden="true">*</span></label>
      {multiline ? <textarea {...props} rows={2} /> : <input {...props} type={name === 'effectiveDate' ? 'date' : 'text'} min={name === 'effectiveDate' ? '1900-01-01' : undefined} max={name === 'effectiveDate' ? '2199-12-31' : undefined} />}
      {errors[name] ? <p className="field-error" id={`${name}-error`}>{errors[name]?.[0]}</p> : hint ? <p className="field-hint" id={`${name}-hint`}>{hint}</p> : null}
    </div>;
  }
  async function generate(types = form.agreements) {
    if (busy) return;
    const result = agreementSchema.safeParse({ ...form, agreements: types });
    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      setErrors(issues);
      const first = Object.keys(issues)[0];
      requestAnimationFrame(() => (document.getElementById(first) ?? document.getElementById('nda-choice'))?.focus());
      notify('Please complete the required details before generating.');
      return;
    }
    setBusy(true); setErrors({});
    try {
      const response = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result.data) });
      if (!response.ok) {
        const problem = await response.json();
        if (problem.fields) setErrors(problem.fields);
        throw new Error(problem.error || 'The documents could not be generated.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      const name = filename(result.data, types.length === 1 ? types[0] : 'agreements');
      setExports(current => [{ url, name, client: result.data.companyFullName, types: [...types], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current]);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = name; anchor.click();
      notify(`${types.length > 1 ? `${types.length} agreements are` : `${types[0].toUpperCase()} is`} ready. Your download has started.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  const previewValues: Record<string, string> = {
    ...form, sow: '', agreements: '', providerName: BRAND,
    effectiveDate: form.effectiveDate ? formatDate(form.effectiveDate) : '[Effective date]',
  };
  const placeholderLabels: Record<string, string> = { ...labels, providerName: BRAND };
  function renderText(text: string) {
    return text.split(/(\{\w+\})/g).map((part, index) => {
      if (!/^\{\w+\}$/.test(part)) return part;
      const key = part.slice(1, -1);
      const value = previewValues[key];
      return <span key={index} className={value ? 'filled-value' : 'empty-value'}>{value || `[${placeholderLabels[key] ?? key}]`}</span>;
    });
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="vedryxTech Document Studio"><Image className="brand-light" src="/brand/logo.svg" alt="vedryxTech" width={172} height={35} style={{ height: 'auto' }} priority /><Image className="brand-dark" src="/brand/logo-white.svg" alt="vedryxTech" width={172} height={35} style={{ height: 'auto' }} /></Link>
      <div className="workspace-label">DOCUMENT STUDIO <span>INTERNAL</span></div>
      <div className="nav-group-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button className={`nav-item ${view === 'create' ? 'active' : ''}`} onClick={() => setView('create')}><FilePlus2 size={18} />Create agreement<ChevronRight size={15} className="nav-chevron" /></button>
        <button className={`nav-item ${view === 'exports' ? 'active' : ''}`} onClick={() => setView('exports')}><FolderDown size={18} />Session downloads<span className="nav-count">{exports.length}</span></button>
      </nav>
      <div className="sidebar-note"><div className="note-icon"><ShieldCheck size={21} /></div><strong>Good partnerships<br />start with clarity.</strong><p>Your agreements.<br />Your brand. One place.</p><div className="mini-rule" /></div>
      <div className="sidebar-bottom"><button onClick={() => setHelp(true)}><CircleHelp size={17} />How it works<ArrowRight size={15} /></button><div className="company-account"><div className="avatar">vT</div><div><strong>vedryxTech</strong><span>Company workspace</span></div><span className="online-dot" /></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view === 'create' ? 'Create agreement' : 'Session downloads'}</strong></div><div className="topbar-actions"><ThemeToggle /><button className="help-button" onClick={() => setHelp(true)} aria-label="Help"><CircleHelp size={16} /></button></div></header>
      {view === 'create' ? <div className="main-content">
        <div className="page-heading"><div><div className="eyebrow"><span /> BUILT FOR BETTER BEGINNINGS</div><h1>Make it official<span>.</span></h1><p>From a new partnership to a signed agreement. Start here.</p></div><button className="button secondary compact" onClick={() => { setForm({ ...emptyForm, effectiveDate: form.effectiveDate, providerAddress: form.providerAddress, providerSignatory: form.providerSignatory, providerDesignation: form.providerDesignation }); setErrors({}); notify('Client details cleared. Your company details are kept.'); }} disabled={busy}><RotateCcw size={15} />Clear client</button></div>
        <div className="studio-grid">
          <form ref={formRef} onSubmit={event => { event.preventDefault(); void generate(); }} noValidate className="agreement-form">
            <section className="form-card"><div className="section-heading"><div className="step-number">01</div><div><h2>Choose your agreements</h2><p>Select one, or create the complete set.</p></div><Files size={19} className="section-icon" /></div>
              <div className="agreement-options">{agreementTypes.map(type => <label className={`agreement-option ${form.agreements.includes(type) ? 'selected' : ''}`} key={type} htmlFor={`${type}-choice`}>
                <input id={`${type}-choice`} type="checkbox" checked={form.agreements.includes(type)} onChange={() => toggle(type)} aria-describedby={errors.agreements ? 'agreement-error' : undefined} />
                <div className="option-top">{type === 'nda' ? <ShieldCheck size={23} /> : type === 'dda' ? <LockKeyhole size={23} /> : <FileText size={23} />}<span className="custom-check">{form.agreements.includes(type) && <Check size={12} strokeWidth={3} />}</span></div>
                <strong>{type.toUpperCase()}</strong><span>{agreementDescriptions[type].short}</span><small>{agreementDescriptions[type].purpose}</small>
              </label>)}</div>{errors.agreements && <p className="field-error" id="agreement-error">{errors.agreements[0]}</p>}
            </section>
            <section className="form-card"><div className="section-heading"><div className="step-number">02</div><div><h2>Client details</h2><p>The company you’re partnering with.</p></div><Building2 size={19} className="section-icon" /></div>
              {field('companyFullName', false, 'Use the full registered name, as it should appear in the agreement.')}
              {field('companyAddress', true)}
              <div className="field-row">{field('clientName')}{field('clientDesignation')}</div>
              {field('effectiveDate')}
            </section>
            <section className="form-card"><div className="section-heading"><div className="step-number">03</div><div><h2>Your company details</h2><p>Representing vedryxTech.</p></div><span className="brand-tag">vedryxTech</span></div>
              {field('providerAddress', true)}<div className="field-row">{field('providerSignatory')}{field('providerDesignation')}</div>
            </section>
            {(form.agreements.includes('sow') || activeTab === 'sow') && <SowEditor value={form.sow ?? emptySow} errors={errors.sow} onChange={sow => { setForm(current => ({ ...current, sow })); setErrors(current => ({ ...current, sow: undefined })); }} />}
            <div className="generate-panel"><div className="generate-summary"><div className="small-file-stack"><Files size={22} /></div><div><strong>{form.agreements.length} agreement{form.agreements.length === 1 ? '' : 's'} selected</strong><span>Editable Word {form.agreements.length > 1 ? 'files · downloaded as ZIP' : 'document · .docx'}</span></div></div>
              <button className="button primary generate-button" disabled={busy || !form.effectiveDate} type="submit">{busy ? <><LoaderCircle size={18} className="spin" />Preparing documents…</> : <><Sparkles size={17} />Generate {form.agreements.length > 1 ? 'agreements' : 'agreement'}<ArrowRight size={18} /></>}</button>
              <p className="privacy-note"><ShieldCheck size={13} />Generated on demand. Documents aren’t saved on the server.</p>
            </div>
          </form>
          <aside className="preview-column" aria-label="Agreement preview">
            <div className="preview-sticky"><div className="preview-title"><div><span className="live-dot" /><h2>Live preview</h2></div><span>Updates as you type</span></div>
              <div className="preview-frame"><div className="preview-toolbar"><div className="preview-tabs" role="tablist" aria-label="Preview agreement">{agreementTypes.map(type => <button key={type} id={`${type}-tab`} role="tab" aria-selected={activeTab === type} aria-controls="agreement-preview" tabIndex={activeTab === type ? 0 : -1} onKeyDown={event => {
                const index = agreementTypes.indexOf(type);
                const next = event.key === 'ArrowRight' ? agreementTypes[(index + 1) % agreementTypes.length] : event.key === 'ArrowLeft' ? agreementTypes[(index + agreementTypes.length - 1) % agreementTypes.length] : event.key === 'Home' ? agreementTypes[0] : event.key === 'End' ? agreementTypes[agreementTypes.length - 1] : null;
                if (next) { event.preventDefault(); setActiveTab(next); document.getElementById(`${next}-tab`)?.focus(); }
              }} onClick={() => setActiveTab(type)} className={activeTab === type ? 'current' : ''}>{type.toUpperCase()}</button>)}</div><span><FileText size={13} /> WORD DOCUMENT</span></div>
                <div className="paper-scroll" id="agreement-preview" role="tabpanel" aria-labelledby={`${activeTab}-tab`} tabIndex={0}><article className="paper" key={activeTab}><div className="paper-brand"><Image src="/brand/logo.svg" alt="vedryxTech" width={145} height={29} style={{ height: 'auto' }} /><span>AGREEMENT</span></div><div className="paper-rule" /><div className="paper-kicker">{agreementDescriptions[activeTab].kicker}</div>
                  <h3>{agreementLabels[activeTab]}</h3><div className="paper-meta"><span>EFFECTIVE DATE</span><strong>{form.effectiveDate ? formatDate(form.effectiveDate) : 'DD/MM/YYYY'}</strong></div>
                  <div className="paper-body">{(activeTab === 'sow' ? sowParagraphs(form) : preview[activeTab]).slice(1).map((paragraph, index) => <p key={index} className={`${paragraph.heading ? 'clause-heading' : ''} ${'signature' in paragraph && paragraph.signature ? `signature-${paragraph.signature}` : ''}`}>{activeTab === 'sow' ? paragraph.text : renderText(paragraph.text)}</p>)}</div>
                  <div className="paper-footer"><span>vedryxTech</span><span>End of agreement</span></div>
                </article></div><div className="preview-bottom"><span><CheckCheck size={14} />vedryxTech branding applied</span><button type="button" aria-label={`Download ${activeTab.toUpperCase()} only`} disabled={busy} onClick={() => void generate([activeTab])}><ArrowDownToLine size={16} /></button></div>
              </div>
              <p className="preview-disclaimer">Text preview · Page layout and signatures are formatted in the Word download.</p>
              <div className="readiness"><div><span>DETAILS COMPLETED</span><strong>{completed}<span> / {Object.keys(labels).length}</span></strong></div><div className="progress-track" role="progressbar" aria-label="Details completed" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={Object.keys(labels).length}><span style={{ width: `${progress}%` }} /></div><p>{progress === 100 ? 'Party details are complete. The SOW also requires scope and pricing.' : 'Complete the details to prepare your agreements.'}</p></div>
              <div className="template-note"><FileCheck2 size={19} /><p><strong>{activeTab === 'dda' ? 'Commitments to verify before live calling.' : activeTab === 'sow' ? 'Scope and pricing, agreed together.' : 'A consistent starting point.'}</strong><br />{activeTab === 'dda' ? 'The DDA requires encrypted storage, restricted access and an agreed operating schedule before processing leads. It does not certify your calling system.' : activeTab === 'sow' ? 'This SOW accompanies the MSA. Review deliverables, billing definitions and payment terms before both parties sign.' : 'The NDA and MSA use your supplied templates. Review the final terms before signing.'}</p></div>
            </div>
          </aside>
        </div>
        <footer className="app-footer"><span>© {new Date().getFullYear()} vedryxTech</span><span>Made for the start of something great.</span></footer>
      </div> : <div className="main-content"><div className="page-heading"><div><div className="eyebrow"><span /> YOUR DOCUMENTS</div><h1>Ready when you are<span>.</span></h1><p>Downloads from this session. Refreshing or closing this page clears this list.</p></div><button className="button primary compact" onClick={() => setView('create')}><Plus size={16} />New agreement</button></div>
        {exports.length === 0 ? <div className="empty-state"><div><FolderDown size={32} /></div><h2>A fresh start.</h2><p>Your generated agreements will appear here.</p><button className="button primary" onClick={() => setView('create')}>Create your first agreement<ArrowRight size={17} /></button></div> : <div className="exports-list">{exports.map((item, index) => <div className="export-row" key={item.url}><div className="export-icon"><FileCheck2 size={23} /></div><div className="export-info"><h2>{item.client}</h2><p>{item.types.map(t => t.toUpperCase()).join(' + ')}<span>·</span><Clock3 size={12} />{item.time}<span>·</span>{index === 0 ? 'Latest download' : 'Generated'}</p></div><a className="button secondary compact" href={item.url} download={item.name}><ArrowDownToLine size={16} />Download</a></div>)}</div>}
      </div>}
    </main>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><FileText size={18} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></>}</div>
    <dialog ref={helpRef} className="help-dialog" onCancel={() => setHelp(false)} onClick={event => { if (event.target === event.currentTarget) setHelp(false); }}><button className="close-dialog" aria-label="Close help" onClick={() => setHelp(false)}><X size={20} /></button><div className="eyebrow">DOCUMENT STUDIO</div><h2>From details to documents.</h2><ol><li><strong>Choose your agreements.</strong> Select an NDA, MSA, data-protection agreement (DDA), SOW, or any combination.</li><li><strong>Fill in both parties’ details.</strong> Enter registered addresses and authorized signatories. Watch the text preview update.</li><li><strong>Download and review.</strong> One agreement downloads as Word; multiple agreements come in a ZIP. Signatures remain blank for each party to sign.</li></ol><p>Session downloads stay available until you refresh or close the page. The NDA and MSA use your supplied templates. The DDA sets safeguards to verify before live lead processing.</p><button className="button primary" onClick={() => setHelp(false)}>Got it<Check size={16} /></button></dialog>
  </div>;
}
