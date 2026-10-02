import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Banknote, Clock3, CreditCard, Download, Eye, FileText, Plus, Printer, Search, X } from 'lucide-react';
import type { Customer, Invoice, InvoiceLineItem, InventoryItem, Service } from '../types';
import type { BusinessLocation } from './SettingsPage';
import { countryFields, countryName } from '../lib/countryProfile';
import './invoices.css';

function defaultDueDate() { const date = new Date(); date.setDate(date.getDate() + 7); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
type DraftInvoiceItem = { id: string; description: string; quantity: string; unitPrice: string; inventoryItemId?: string };
function blankInvoiceItem(): DraftInvoiceItem { return { id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }; }

export function InvoicePage({ customers, invoices, services, inventory, onCreate, prefillCustomerId, onPrefillHandled, businessName, businessLocation }: { businessName: string; businessLocation: BusinessLocation; customers: Customer[]; invoices: Invoice[]; services: Service[]; inventory: InventoryItem[]; prefillCustomerId?: string | null; onPrefillHandled: () => void; onCreate: (input: { customerId: string; description: string; items: InvoiceLineItem[]; amount: number; taxRate: number; dueDate: string }) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All statuses' | Invoice['status'] | 'Overdue'>('All statuses');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lineItems, setLineItems] = useState<DraftInvoiceItem[]>([blankInvoiceItem()]);
  const [taxRate, setTaxRate] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const businessAddressLines = [
    businessLocation.addressLine1,
    [businessLocation.city, businessLocation.district].filter(Boolean).join(', '),
    [businessLocation.region, businessLocation.postalCode].filter(Boolean).join(' '),
    countryName(businessLocation.country),
  ].filter(Boolean);
  const previewCustomer = previewInvoice ? customers.find(customer => customer.id === previewInvoice.customerId) : undefined;
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const invoiceTotal = subtotal + taxAmount;
  const previewItems: InvoiceLineItem[] = previewInvoice?.items?.length ? previewInvoice.items : previewInvoice ? [{ description: previewInvoice.description, quantity: 1, unitPrice: previewInvoice.subtotal ?? previewInvoice.amount, total: previewInvoice.subtotal ?? previewInvoice.amount }] : [];
  useEffect(() => { if (prefillCustomerId) { setSelectedCustomerId(prefillCustomerId); setFormOpen(true); onPrefillHandled(); } }, [prefillCustomerId, onPrefillHandled]);
  const todayIso = (() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; })();
  const isOverdue = (invoice: Invoice) => invoice.status !== 'Paid' && invoice.dueDate < todayIso;
  const filtered = useMemo(() => invoices.filter(invoice => {
    const matchesQuery = `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All statuses' || (statusFilter === 'Overdue' ? isOverdue(invoice) : invoice.status === statusFilter);
    return matchesQuery && matchesStatus;
  }), [invoices, query, statusFilter, todayIso]);
  const totalDue = invoices.reduce((sum, invoice) => sum + invoice.amount - (invoice.paidAmount ?? 0), 0);
  const totalCollected = invoices.reduce((sum, invoice) => sum + (invoice.paidAmount ?? 0), 0);
  const overdueCount = invoices.filter(isOverdue).length;
  const recentInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  function exportInvoicesCsv() {
    const cell = (value: string | number) => {
      const text = String(value);
      const safeText = /^\s*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows: (string | number)[][] = [
      ['Invoice number', 'Customer', 'Description', 'Items', 'Currency', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance due', 'Issue date', 'Due date', 'Status'],
      ...filtered.map(invoice => {
        const items = invoice.items?.length
          ? invoice.items.map(item => `${item.description} × ${item.quantity} @ ${item.unitPrice}`).join('; ')
          : invoice.description;
        const balance = Math.max(0, invoice.amount - (invoice.paidAmount ?? 0));
        return [invoice.invoiceNumber, invoice.customerName, invoice.description, items, getBusinessCurrencyCode(), invoice.subtotal ?? invoice.amount, invoice.tax ?? 0, invoice.amount, invoice.paidAmount ?? 0, balance, new Date(invoice.createdAt).toLocaleDateString('en-CA'), invoice.dueDate, isOverdue(invoice) ? 'Overdue' : invoice.status];
      }),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(cell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const date = new Date();
    const fileDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    link.download = `bizpilot-invoices-${fileDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const items = lineItems.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100, ...(item.inventoryItemId ? { inventoryItemId: item.inventoryItemId } : {}) }));
      await onCreate({ customerId: String(data.get('customerId') ?? ''), description: items.map(item => item.description).join(', '), items, amount: subtotal, taxRate: Number(data.get('taxRate')), dueDate: String(data.get('dueDate') ?? '') });
      setFormOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this invoice.'); }
    finally { setSaving(false); }
  }

  function updateInvoiceItem(id: string, field: 'description' | 'quantity' | 'unitPrice', value: string) {
    setLineItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function addServiceItem(serviceId: string) {
    const service = services.find(item => item.id === serviceId);
    if (!service) return;
    setLineItems(current => current.length === 1 && !current[0].description.trim() && !current[0].unitPrice
      ? [{ ...current[0], description: service.name, unitPrice: String(service.price) }]
      : [...current, { ...blankInvoiceItem(), description: service.name, unitPrice: String(service.price) }]);
  }

  function selectInventoryVariant(draftId: string, inventoryId: string) {
    const variant = inventory.find(item => item.id === inventoryId);
    setLineItems(current => current.map(item => item.id !== draftId ? item : variant
      ? { ...item, inventoryItemId: variant.id, description: [variant.name, variant.size, variant.color].filter(Boolean).join(' · '), unitPrice: String(variant.sellingPrice) }
      : { ...item, inventoryItemId: undefined }));
  }

  return <><div className="page-heading section-heading"><div><div className="eyebrow">FINANCE <span>/</span> BILLING</div><h1>Billing</h1><p>Create invoices and keep track of what’s due.</p></div><div className="invoice-page-actions"><button type="button" className="secondary-button" title="Export the currently filtered invoices as a CSV file" onClick={exportInvoicesCsv} disabled={filtered.length === 0}><Download size={15}/>Export CSV</button><button className="primary-button" onClick={() => { setError(''); setLineItems([blankInvoiceItem()]); setTaxRate(0); setSelectedCustomerId(''); setFormOpen(true); }}><Plus size={17}/>Create invoice</button></div></div><div className="invoice-summary"><div className="panel invoice-summary-card"><span className="invoice-summary-icon blue"><FileText size={16}/></span><span>Total invoices</span><strong>{invoices.length}</strong><small>All invoices in this workspace</small></div><div className="panel invoice-summary-card"><span className="invoice-summary-icon green"><Banknote size={16}/></span><span>Collected</span><strong>{formatCurrency(totalCollected)}</strong><small>Payments recorded on invoices</small></div><div className="panel invoice-summary-card"><span className="invoice-summary-icon violet"><CreditCard size={16}/></span><span>Outstanding</span><strong>{formatCurrency(totalDue)}</strong><small>Remaining balance due</small></div><div className="panel invoice-summary-card"><span className="invoice-summary-icon amber"><Clock3 size={16}/></span><span>Overdue</span><strong>{overdueCount}</strong><small>Invoices past their due date</small></div></div><div className="billing-layout"><section className="panel section-table"><div className="table-toolbar invoice-toolbar"><div className="search-field"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search invoices" aria-label="Search invoices"/></div><label className="invoice-status-filter"><span>Status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option>All statuses</option><option>Unpaid</option><option>Partially paid</option><option>Paid</option><option>Overdue</option></select></label><span>{filtered.length} invoices</span></div><div className="table-header invoice-table"><span>INVOICE</span><span>CUSTOMER</span><span>AMOUNT</span><span>DUE DATE</span><span>STATUS</span></div>{filtered.map(invoice => <div className="table-row invoice-table" key={invoice.id}><button type="button" className="invoice-number invoice-view" onClick={() => setPreviewInvoice(invoice)}><FileText size={15}/>{invoice.invoiceNumber}<Eye size={13}/></button><span><strong>{invoice.customerName}</strong></span><strong>{formatCurrency(invoice.amount - (invoice.paidAmount ?? 0))}</strong><span>{new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className={`status ${isOverdue(invoice) ? 'overdue' : invoice.status === 'Paid' ? 'completed' : invoice.status === 'Partially paid' ? 'confirmed' : 'pending'}`}>{isOverdue(invoice) ? 'Overdue' : invoice.status}</span></div>)}{filtered.length === 0 && <div className="invoice-empty"><div><FileText size={20}/></div><strong>{invoices.length ? 'No invoices found' : 'No invoices yet'}</strong><span>{invoices.length ? 'Try a different search or status filter.' : 'Create your first invoice to keep track of what customers owe.'}</span>{!invoices.length && <button className="text-button" onClick={() => setFormOpen(true)}>Create an invoice <ArrowUpRight size={15}/></button>}</div>}</section><aside className="billing-aside"><section className="billing-outstanding"><div className="billing-side-heading"><span>Outstanding balance</span><span className="billing-info-dot" aria-label="Unpaid balance across invoices">i</span></div><strong>{formatCurrency(totalDue)}</strong><small>{overdueCount ? `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} overdue` : 'No overdue invoices'}</small><button className="primary-button" onClick={() => { setError(''); setLineItems([blankInvoiceItem()]); setTaxRate(0); setSelectedCustomerId(''); setFormOpen(true); }}><Plus size={15}/>Create invoice</button></section><section className="billing-activity"><div className="billing-activity-heading"><strong>Recent activity</strong><span>{recentInvoices.length}</span></div>{recentInvoices.length ? recentInvoices.map(invoice => <div className="billing-activity-row" key={invoice.id}><i className={invoice.status === 'Paid' ? 'paid' : 'due'}><FileText size={12}/></i><span><strong>{invoice.customerName}</strong><small>{invoice.invoiceNumber} · {new Date(invoice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></span><em className={invoice.status === 'Paid' ? 'paid' : 'due'}>{isOverdue(invoice) ? 'Overdue' : invoice.status}</em></div>) : <p className="billing-activity-empty">New invoices and payment updates will appear here.</p>}</section></aside></div>{previewInvoice && <div className="modal-backdrop invoice-print-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewInvoice(null); }}><article className="invoice-document"><header><div><span className="invoice-document-brand">BIZPILOT</span><h2>{businessName}</h2><p>Business invoice</p></div><button className="icon-button invoice-document-close" aria-label="Close invoice" onClick={() => setPreviewInvoice(null)}><X size={18}/></button></header>{(businessAddressLines.length > 0 || businessLocation.taxId) && <div className="invoice-business-details">{businessAddressLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}{businessLocation.taxId && <span>{countryFields(businessLocation.country).taxLabel}: {businessLocation.taxId}</span>}</div>}<div className="invoice-document-meta"><div><span>INVOICE</span><strong>{previewInvoice.invoiceNumber}</strong></div><div className="invoice-bill-to"><span>BILL TO</span><strong>{previewInvoice.customerName}</strong>{previewCustomer?.email && <small>{previewCustomer.email}</small>}{previewCustomer?.phone && <small>{previewCustomer.phone}</small>}</div><div><span>DUE DATE</span><strong>{new Date(`${previewInvoice.dueDate}T00:00:00`).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div></div><div className="invoice-document-items"><div className="invoice-document-items-header"><span>ITEM</span><span>QTY</span><span>UNIT PRICE</span><span>AMOUNT</span></div>{previewItems.map((item, index) => <div className="invoice-document-item-row" key={`${item.description}-${index}`}><span>{item.description}</span><span>{item.quantity}</span><span>{formatCurrency(item.unitPrice)}</span><strong>{formatCurrency(item.total)}</strong></div>)}</div><div className="invoice-document-totals"><div><span>Subtotal</span><strong>{formatCurrency(previewInvoice.subtotal ?? previewInvoice.amount)}</strong></div><div><span>Tax</span><strong>{formatCurrency(previewInvoice.tax ?? 0)}</strong></div><div className="invoice-document-total"><span>Total</span><strong>{formatCurrency(previewInvoice.amount)}</strong></div><div><span>Paid</span><strong>{formatCurrency(previewInvoice.paidAmount ?? 0)}</strong></div><div><span>Balance due</span><strong>{formatCurrency(Math.max(0, previewInvoice.amount - (previewInvoice.paidAmount ?? 0)))}</strong></div></div><div className="invoice-document-status">{previewInvoice.status}</div><footer>Thank you for your business.<span>Generated with BizPilot</span></footer><div className="invoice-document-actions"><button className="secondary-button" onClick={() => setPreviewInvoice(null)}>Close</button><button className="primary-button" onClick={() => window.print()}><Printer size={15}/>Print / Save as PDF</button></div></article></div>}{formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-form-title"><div className="modal-heading"><div><h2 id="invoice-form-title">Create an invoice</h2><p>Record an amount due from a customer.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}><X size={18}/></button></div><form onSubmit={submit}><label>Customer<select name="customerId" required value={selectedCustomerId} onChange={event => setSelectedCustomerId(event.target.value)} disabled={customers.length === 0}><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>{customers.length === 0 && <p className="form-error">Add a customer before creating an invoice.</p>}{services.length > 0 && <label>Fill an item from a saved service<select value="" onChange={event => addServiceItem(event.target.value)}><option value="">Choose a service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>)}</select></label>}<div className="invoice-items-editor"><div className="invoice-items-heading"><strong>Invoice items</strong><span>Choose a saved product variant to use its price and reduce stock, or enter a custom item.</span></div>{lineItems.map((item, index) => <div className="invoice-item-edit-row" key={item.id}><label>Product variant<select value={item.inventoryItemId ?? ''} onChange={event => selectInventoryVariant(item.id, event.target.value)}><option value="">Custom item</option>{inventory.map(variant => <option key={variant.id} value={variant.id} disabled={variant.quantity < 1 && variant.id !== item.inventoryItemId}>{variant.name}{variant.size ? ` · ${variant.size}` : ''}{variant.color ? ` · ${variant.color}` : ''} · {formatCurrency(variant.sellingPrice)} · {variant.quantity} left</option>)}</select></label><label>Item {index + 1}<input value={item.description} onChange={event => updateInvoiceItem(item.id, 'description', event.target.value)} readOnly={Boolean(item.inventoryItemId)} required maxLength={200} placeholder="e.g. Haircut and styling"/></label><label>Qty<input type="number" min="0.01" max="10000" step="0.01" value={item.quantity} onChange={event => updateInvoiceItem(item.id, 'quantity', event.target.value)} required/></label><label>Unit price ({getBusinessCurrencyCode()})<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => updateInvoiceItem(item.id, 'unitPrice', event.target.value)} readOnly={Boolean(item.inventoryItemId)} required placeholder="0.00"/></label><strong className="invoice-item-row-total">{formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</strong><button type="button" className="invoice-remove-item" aria-label={`Remove item ${index + 1}`} disabled={lineItems.length === 1} onClick={() => setLineItems(current => current.filter(row => row.id !== item.id))}><X size={14}/></button></div>)}<button type="button" className="invoice-add-item" onClick={() => setLineItems(current => [...current, blankInvoiceItem()])}><Plus size={14}/> Add item</button></div><label>Tax rate (%)<input name="taxRate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={event => setTaxRate(Number(event.target.value))}/></label><div className="invoice-tax-preview"><span>Subtotal <strong>{formatCurrency(subtotal)}</strong></span><span>Tax ({taxRate}%) <strong>{formatCurrency(taxAmount)}</strong></span><span>Total due <strong>{formatCurrency(invoiceTotal)}</strong></span></div><label>Due date<input name="dueDate" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={defaultDueDate()} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || customers.length === 0}>{saving ? 'Saving…' : 'Save invoice'}</button></div></form></section></div>}</>;
}
