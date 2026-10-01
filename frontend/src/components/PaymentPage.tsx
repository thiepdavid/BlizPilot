import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, Check, CreditCard, Copy, ExternalLink, Link2, Plus, Search, X } from 'lucide-react';
import type { Invoice, Payment } from '../types';
import './payments.css';

function balance(invoice: Invoice) { return Math.max(0, invoice.amount - (invoice.paidAmount ?? 0)); }

export function PaymentPage({ invoices, payments, onCreate, onCreatePaymentLink, prefillInvoiceId, onPrefillHandled, businessName }: { businessName: string; invoices: Invoice[]; payments: Payment[]; onCreate: (input: { invoiceId: string; amount: number; method: Payment['method'] }) => Promise<void>; onCreatePaymentLink: (invoiceId: string) => Promise<{ url: string; amount: number }>; prefillInvoiceId?: string | null; onPrefillHandled: () => void }) {
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [copyError, setCopyError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkingId, setLinkingId] = useState('');
  const [paymentLinks, setPaymentLinks] = useState<Record<string, { url: string; amount: number }>>({});
  const outstanding = invoices.filter(invoice => balance(invoice) > 0);
  const selectedInvoice = outstanding.find(invoice => invoice.id === selectedInvoiceId);
  const filtered = useMemo(() => payments.filter(payment => `${payment.invoiceNumber} ${payment.customerName} ${payment.method}`.toLowerCase().includes(query.toLowerCase())), [payments, query]);
  const totalReceived = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOutstanding = invoices.reduce((sum, invoice) => sum + balance(invoice), 0);
  useEffect(() => { if (prefillInvoiceId) { const invoice = outstanding.find(item => item.id === prefillInvoiceId); if (invoice) { setSelectedInvoiceId(invoice.id); setAmount(balance(invoice).toFixed(2)); setFormOpen(true); } onPrefillHandled(); } }, [prefillInvoiceId]);

  async function copyReminder(invoice: Invoice) {
    const dueDate = new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric' });
    const message = `Hi ${invoice.customerName}, just a friendly reminder that invoice ${invoice.invoiceNumber} for ${formatCurrency(balance(invoice))} is due${invoice.dueDate ? ` on ${dueDate}` : ''}. Please let me know if you have any questions. Thank you, ${businessName}.`;
    setCopyError('');
    try { await navigator.clipboard.writeText(message); setCopiedId(invoice.id); window.setTimeout(() => setCopiedId(current => current === invoice.id ? '' : current), 2200); }
    catch { setCopyError('Could not copy the reminder. Check your browser clipboard permission.'); }
  }

  async function createPaymentLink(invoice: Invoice) {
    setLinkError(''); setLinkingId(invoice.id);
    try {
      const link = await onCreatePaymentLink(invoice.id);
      setPaymentLinks(current => ({ ...current, [invoice.id]: link }));
      try { await navigator.clipboard.writeText(link.url); setCopiedId(`link-${invoice.id}`); window.setTimeout(() => setCopiedId(current => current === `link-${invoice.id}` ? '' : current), 2200); }
      catch { /* The link is still visible and can be opened/copied manually. */ }
    } catch (reason) { setLinkError(reason instanceof Error ? reason.message : 'Could not create this payment link.'); }
    finally { setLinkingId(''); }
  }

  async function copyPaymentLink(invoiceId: string) {
    const url = paymentLinks[invoiceId]?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkError(''); setCopiedId(`link-${invoiceId}`);
      window.setTimeout(() => setCopiedId(current => current === `link-${invoiceId}` ? '' : current), 2200);
    } catch { setLinkError('The link is ready above. Open it and copy the address to share it.'); }
  }

  function openForm() { setError(''); setSelectedInvoiceId(outstanding[0]?.id ?? ''); setAmount(outstanding[0] ? balance(outstanding[0]).toFixed(2) : ''); setFormOpen(true); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      await onCreate({ invoiceId: String(data.get('invoiceId') ?? ''), amount: Number(data.get('amount')), method: String(data.get('method') ?? 'Other') as Payment['method'] });
      setFormOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record this payment.'); }
    finally { setSaving(false); }
  }

  return <><div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> PAYMENTS</div><h1>Payments</h1><p>Collect online or record a payment you received.</p></div><button className="primary-button" onClick={openForm} disabled={outstanding.length === 0}><Plus size={17}/>Record payment</button></div><div className="invoice-summary"><div className="panel invoice-summary-card"><span>Total received</span><strong>{formatCurrency(totalReceived)}</strong><small>{payments.length} recorded payments</small></div><div className="panel invoice-summary-card"><span>Still outstanding</span><strong>{formatCurrency(totalOutstanding)}</strong><small>Across unpaid invoices</small></div></div>{outstanding.length > 0 && <section className="panel reminder-panel"><div className="table-toolbar"><div><strong>Invoices needing payment</strong><small>{getBusinessCurrencyCode() === 'INR' ? 'Create a secure Razorpay link and share it with your customer.' : 'Online payment links are currently available for INR businesses only.'}</small></div><span>{outstanding.length} outstanding</span></div>{outstanding.map(invoice => <div className="reminder-row" key={invoice.id}><div><strong>{invoice.customerName}</strong><span>{invoice.invoiceNumber} · {formatCurrency(balance(invoice))} due</span>{paymentLinks[invoice.id] && <a className="payment-link-url" href={paymentLinks[invoice.id].url} target="_blank" rel="noreferrer">Payment link · {formatCurrency(paymentLinks[invoice.id].amount)} <ExternalLink size={12}/></a>}</div><div className="payment-row-actions">{paymentLinks[invoice.id] ? <button className="secondary-button reminder-copy" onClick={() => void copyPaymentLink(invoice.id)}>{copiedId === `link-${invoice.id}` ? <Check size={14}/> : <Copy size={14}/>} {copiedId === `link-${invoice.id}` ? 'Link copied' : 'Copy link'}</button> : getBusinessCurrencyCode() === 'INR' ? <button className="secondary-button reminder-copy" disabled={linkingId === invoice.id} onClick={() => void createPaymentLink(invoice)}><Link2 size={14}/>{linkingId === invoice.id ? 'Creating…' : 'Create pay link'}</button> : <span className="payment-demo-note">INR only</span>}<button className="secondary-button reminder-copy" onClick={() => void copyReminder(invoice)}>{copiedId === invoice.id ? <Check size={14}/> : <Copy size={14}/>} {copiedId === invoice.id ? 'Copied' : 'Copy reminder'}</button></div></div>)}{linkError && <p className="form-error" role="alert">{linkError}</p>}{copyError && <p className="form-error" role="alert">{copyError}</p>}<p className="payment-demo-note">Customers pay on Razorpay’s hosted page. BizPilot records successful payments after Razorpay confirms them.</p></section>}<section className="panel section-table"><div className="table-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search payments" aria-label="Search payments"/></div><span>{filtered.length} payments</span></div><div className="table-header payment-table"><span>PAYMENT</span><span>CUSTOMER / INVOICE</span><span>METHOD</span><span>DATE</span><span>AMOUNT</span></div>{filtered.map(payment => <div className="table-row payment-table" key={payment.id}><span className="payment-method-icon"><ArrowDownLeft size={15}/></span><span className="payment-customer"><strong>{payment.customerName}</strong><small>{payment.invoiceNumber}</small></span><span>{payment.method}</span><span>{new Date(payment.receivedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><strong>{formatCurrency(payment.amount)}</strong></div>)}{filtered.length === 0 && <div className="invoice-empty"><div><CreditCard size={20}/></div><strong>{query ? 'No payments found' : 'No payments recorded'}</strong><span>{query ? 'Try another search.' : outstanding.length ? 'Create a payment link or record a payment to update an invoice.' : invoices.length ? 'All invoices are paid. Create another invoice to record a payment.' : 'Create an invoice before recording a payment.'}</span>{!query && outstanding.length > 0 && <button className="text-button" onClick={openForm}>Record a payment <ArrowDownLeft size={15}/></button>}</div>}</section>{formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="payment-form-title"><div className="modal-heading"><div><h2 id="payment-form-title">Record a payment</h2><p>Log money received against an invoice.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}><X size={18}/></button></div><form onSubmit={submit}><label>Invoice<select name="invoiceId" value={selectedInvoiceId} onChange={event => { const id = event.target.value; setSelectedInvoiceId(id); const invoice = outstanding.find(item => item.id === id); setAmount(invoice ? balance(invoice).toFixed(2) : ''); }} required>{outstanding.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.customerName} · {formatCurrency(balance(invoice))} due</option>)}</select></label>{selectedInvoice && <div className="payment-balance-note">Remaining balance: <strong>{formatCurrency(balance(selectedInvoice))}</strong></div>}<label>Amount received ({getBusinessCurrencyCode()})<input name="amount" type="number" min="0.01" step="0.01" max={selectedInvoice ? balance(selectedInvoice) : undefined} value={amount} onChange={event => setAmount(event.target.value)} required placeholder="0.00"/></label><label>Payment method<select name="method" defaultValue={getBusinessCurrencyCode() === 'INR' ? 'UPI' : 'Card'}>{getBusinessCurrencyCode() === 'INR' && <option>UPI</option>}<option>Cash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="payment-demo-note">This records a payment in BizPilot. It does not charge a card or transfer money.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || !selectedInvoice}>{saving ? 'Saving…' : 'Save payment'}</button></div></form></section></div>}</>;
}
