import { formatCurrency } from '../lib/currency';
import { readCsvUpload, sanitizeCsvCell } from '../lib/csvUpload';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CalendarDays, Download, FileText, Plus, Search, Upload, X, CircleDollarSign } from 'lucide-react';
import type { Appointment, Customer, Invoice, NavKey, Payment } from '../types';
import { DailyBriefPage } from './DailyBriefPage';

type Section = 'Customers' | 'AI' | 'Settings';
const details: Record<Section, { title: string; description: string; action: string }> = {
  Customers: { title: 'Customers', description: 'Get to know the people who make your business.', action: 'Add customer' },
  AI: { title: 'Daily Brief', description: 'A practical summary of the business records that may need your attention.', action: 'Explore your daily brief' },
  Settings: { title: 'Settings', description: 'Make BizPilot work the way your business does.', action: 'Save changes' },
};
type CustomerImportRow = { name: string; email: string; phone: string; notes?: string; issue?: string };
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') { if (char === '\r' && source[index + 1] === '\n') index++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(parsedRow => parsedRow.map(sanitizeCsvCell));
}
export function SectionPage({ section, customers, appointments, invoices, payments, apiBase, authToken, onAddCustomer, onUpdateCustomer, onBookAppointment, onCreateInvoice, onRecordPayment, onNavigate }: { section: Section; customers: Customer[]; appointments: Appointment[]; invoices: Invoice[]; payments: Payment[]; apiBase: string; authToken?: string; onAddCustomer: (input: { name: string; email: string; phone: string; notes?: string }) => Promise<void>; onUpdateCustomer: (id: string, input: { name: string; email: string; phone: string; notes?: string }) => Promise<void>; onBookAppointment: (customerId: string) => void; onCreateInvoice: (customerId: string) => void; onRecordPayment: (invoiceId: string) => void; onNavigate: (section: NavKey) => void }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<CustomerImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const page = details[section];
  const filteredCustomers = customers.filter(c => `${c.name} ${c.email} ${c.phone ?? ''}`.toLowerCase().includes(customerSearch.toLowerCase()));
  const customerAppointments = selectedCustomer ? appointments.filter(item => item.customerId === selectedCustomer.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt)) : [];
  const customerInvoices = selectedCustomer ? invoices.filter(item => item.customerId === selectedCustomer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const totalBilled = customerInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const invoiceIds = new Set(customerInvoices.map(invoice => invoice.id));
  const customerPayments = payments.filter(payment => invoiceIds.has(payment.invoiceId)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const totalCollected = customerPayments.reduce((sum, payment) => sum + payment.amount, 0);

  function exportCustomers() {
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Name', 'Email', 'Phone', 'Notes', 'Visits', 'Last visit'],
      ...filteredCustomers.map(customer => [customer.name, customer.email, customer.phone ?? '', customer.notes ?? '', customer.visits, customer.lastVisit]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizpilot-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadCustomerCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    void readCsvUpload(file).then(text => {
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('Add a header row and at least one customer.');
      if (rows.length > 501) throw new Error('Import up to 500 customers at a time.');
      const headers = rows[0].map(header => header.trim().toLowerCase().replace(/[_\s]+/g, ' '));
      const nameIndex = headers.findIndex(header => header === 'name' || header === 'full name');
      const emailIndex = headers.indexOf('email'); const phoneIndex = headers.findIndex(header => header === 'phone' || header === 'phone number'); const notesIndex = headers.indexOf('notes');
      if (nameIndex < 0) throw new Error('The CSV must include a Name column. Email and Phone columns are optional.');
      const knownEmails = new Set(customers.map(customer => customer.email.trim().toLowerCase()).filter(Boolean));
      const knownPhones = new Set(customers.map(customer => (customer.phone ?? '').replace(/\D/g, '')).filter(Boolean));
      const parsed: CustomerImportRow[] = [];
      for (const values of rows.slice(1).filter(row => row.some(value => value.trim()))) {
        const customer = { name: (values[nameIndex] ?? '').trim(), email: (values[emailIndex] ?? '').trim(), phone: (values[phoneIndex] ?? '').trim(), notes: (values[notesIndex] ?? '').trim() };
        if (customer.name.length < 2) { parsed.push({ ...customer, issue: 'Name is missing or too short' }); continue; }
        if (customer.name.length > 160 || customer.email.length > 254 || customer.phone.length > 50 || (customer.notes?.length ?? 0) > 2000) { parsed.push({ ...customer, issue: 'Name, email, phone, or notes exceed the allowed length' }); continue; }
        const email = customer.email.toLowerCase(); const phone = customer.phone.replace(/\D/g, '');
        if ((email && knownEmails.has(email)) || (phone && knownPhones.has(phone))) { parsed.push({ ...customer, issue: 'Email or phone already exists' }); continue; }
        if (email) knownEmails.add(email);
        if (phone) knownPhones.add(phone);
        parsed.push(customer);
      }
      if (!parsed.length) throw new Error('No customer rows were found in that file.');
      setImportRows(parsed); setImportError(''); setImportMessage(''); setImportOpen(true);
    }).catch(error => setImportError(error instanceof Error ? error.message : 'Could not read this CSV file.'));
  }

  async function importCustomers() {
    const ready = importRows.filter(row => !row.issue);
    if (!ready.length) return;
    setImporting(true); setImportError(''); let saved = 0;
    try {
      for (const row of ready) { await onAddCustomer({ name: row.name, email: row.email, phone: row.phone, notes: row.notes }); saved++; }
      setImportOpen(false); setImportRows([]); setImportMessage(`${saved} customer${saved === 1 ? '' : 's'} imported.`);
    } catch (error) { setImportError(`${saved} imported before the next row failed: ${error instanceof Error ? error.message : 'Could not save customer.'}`); }
    finally { setImporting(false); }
  }

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setFormError('');
    try {
      const input = { name: String(data.get('name') ?? '').trim(), email: String(data.get('email') ?? '').trim(), phone: String(data.get('phone') ?? '').trim(), notes: String(data.get('notes') ?? '').trim() };
      if (editingCustomer) await onUpdateCustomer(editingCustomer.id, input); else await onAddCustomer(input);
      setFormOpen(false);
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save this customer. Please try again.'); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> {section.toUpperCase()}</div><h1>{page.title}</h1><p>{page.description}</p></div>{section === 'Customers' && <button className="primary-button" onClick={() => { setEditingCustomer(null); setFormError(''); setFormOpen(true); }}><Plus size={17}/>{page.action}</button>}</div>
    {section === 'AI' ? <DailyBriefPage customers={customers} appointments={appointments} invoices={invoices} onNavigate={onNavigate} onBookAppointment={onBookAppointment} apiBase={apiBase} authToken={authToken}/> : section === 'Settings' ? <section className="panel placeholder-panel"><div className="placeholder-icon"><span>⚙</span></div><h2>Your workspace settings</h2><p>Business profile, preferences, and team settings will live here.</p></section> : <section className="panel section-table"><div className="table-toolbar"><div className="search-field"><Search size={16}/><input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Search customers" aria-label="Search customers"/></div><span>{filteredCustomers.length} customers</span><input className="customer-import-input" type="file" accept=".csv,text/csv" aria-label="Choose customer CSV" onChange={loadCustomerCsv}/><button className="customer-import-button" type="button" onClick={event => { const input = event.currentTarget.parentElement?.querySelector<HTMLInputElement>('.customer-import-input'); input?.click(); }}><Upload size={14}/>Import CSV</button><button className="customer-export-button" type="button" onClick={exportCustomers} disabled={filteredCustomers.length === 0}><Download size={14}/>Export CSV</button></div><div className="table-header customer-table"><span>CUSTOMER</span><span>VISITS</span><span>LAST VISIT</span></div>{filteredCustomers.map(c => <div className="table-row customer-table" key={c.id}><button type="button" className="table-customer customer-profile-trigger" onClick={() => setSelectedCustomer(c)}><div className={`person-avatar ${c.tone}`}>{c.initials}</div><span><strong>{c.name}</strong><small>{c.email || c.phone || 'No contact details'}</small></span></button><span>{c.visits}</span><span>{c.lastVisit}</span></div>)}{filteredCustomers.length === 0 && <div className="empty-state">No customers match that search.</div>}</section>}
    {importError && !importOpen && <p className="form-error" role="alert">{importError}</p>}{importMessage && <p className="import-success" role="status">{importMessage}</p>}
    {selectedCustomer && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedCustomer(null); }}><section className="customer-modal customer-profile-modal" role="dialog" aria-modal="true" aria-labelledby="customer-profile-title"><div className="modal-heading"><div><h2 id="customer-profile-title">{selectedCustomer.name}</h2><p>Customer profile and activity</p></div><button className="icon-button" aria-label="Close profile" onClick={() => setSelectedCustomer(null)}><X size={18}/></button></div><div className="profile-actions">{customerInvoices.some(invoice => invoice.amount > (invoice.paidAmount ?? 0)) && <button className="primary-button" onClick={() => { const invoice = customerInvoices.find(item => item.amount > (item.paidAmount ?? 0)); if (invoice) { setSelectedCustomer(null); onRecordPayment(invoice.id); } }}>Record payment</button>}<button className="primary-button" onClick={() => { const customerId = selectedCustomer.id; setSelectedCustomer(null); onBookAppointment(customerId); }}>Book appointment</button><button className="secondary-button" onClick={() => { const customerId = selectedCustomer.id; setSelectedCustomer(null); onCreateInvoice(customerId); }}>Create invoice</button><button className="secondary-button" onClick={() => { setEditingCustomer(selectedCustomer); setSelectedCustomer(null); setFormError(''); setFormOpen(true); }}>Edit details</button></div><div className="profile-contact">{selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}{selectedCustomer.email && <span>{selectedCustomer.email}</span>}{!selectedCustomer.phone && !selectedCustomer.email && <span>No contact details saved</span>}</div><div className="customer-notes"><strong>Private notes</strong><p>{selectedCustomer.notes?.trim() || "No notes saved yet."}</p></div><div className="profile-stats"><div><span>Visits</span><strong>{customerAppointments.filter(item => item.status === 'Completed').length || selectedCustomer.visits}</strong></div><div><span>Total billed</span><strong>{formatCurrency(totalBilled)}</strong></div><div><span>Outstanding</span><strong>{formatCurrency(customerInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - (invoice.paidAmount ?? 0)), 0))}</strong></div><div><span>Collected</span><strong>{formatCurrency(totalCollected)}</strong></div></div><div className="profile-history"><div className="profile-history-heading"><h3><CalendarDays size={15}/> Appointments</h3><span>{customerAppointments.length}</span></div>{customerAppointments.length ? customerAppointments.slice(0, 5).map(item => <div className="profile-history-row" key={item.id}><span>{new Date(item.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><strong>{item.service}</strong><span className={`status ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span></div>) : <p className="profile-empty">No appointments recorded.</p>}</div><div className="profile-history"><div className="profile-history-heading"><h3><FileText size={15}/> Invoices</h3><span>{customerInvoices.length}</span></div>{customerInvoices.length ? customerInvoices.slice(0, 5).map(invoice => <div className="profile-history-row" key={invoice.id}><span>{invoice.invoiceNumber}</span><strong>{formatCurrency(invoice.amount)}</strong><span className={`status ${invoice.status === 'Paid' ? 'completed' : invoice.status === 'Partially paid' ? 'confirmed' : 'pending'}`}>{invoice.status}</span></div>) : <p className="profile-empty">No invoices recorded.</p>}</div><div className="profile-history"><div className="profile-history-heading"><h3><CircleDollarSign size={15}/> Payments</h3><span>{customerPayments.length}</span></div>{customerPayments.length ? customerPayments.slice(0, 5).map(payment => <div className="profile-history-row" key={payment.id}><span>{new Date(payment.receivedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><strong>{formatCurrency(payment.amount)}</strong><span>{payment.method} · {payment.invoiceNumber}</span></div>) : <p className="profile-empty">No payments recorded.</p>}</div></section></div>}
    {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title"><div className="modal-heading"><div><h2 id="customer-form-title">{editingCustomer ? 'Edit customer' : 'Add a customer'}</h2><p>{editingCustomer ? 'Update their contact details.' : 'Save their details to your customer list.'}</p></div><button className="icon-button" aria-label="Close form" onClick={() => { setFormOpen(false); setEditingCustomer(null); }}><X size={18}/></button></div><form onSubmit={submitCustomer}><label>Full name<input name="name" autoFocus required minLength={2} defaultValue={editingCustomer?.name ?? ''} placeholder="e.g. Asha Patel"/></label><label>Phone number <span>(optional)</span><input name="phone" type="tel" defaultValue={editingCustomer?.phone ?? ''} placeholder="+country code and number"/></label><label>Email address <span>(optional)</span><input name="email" type="email" defaultValue={editingCustomer?.email ?? ''} placeholder="asha@example.com"/></label><label>Private notes <span>(optional, up to 2,000 characters)</span><textarea name="notes" maxLength={2000} rows={4} defaultValue={editingCustomer?.notes ?? ''} placeholder="Service preferences or reminders. Avoid sensitive details."/></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setFormOpen(false); setEditingCustomer(null); }}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : editingCustomer ? 'Save changes' : 'Save customer'}</button></div></form></section></div>}
    {importOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !importing) setImportOpen(false); }}><section className="customer-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="customer-import-title"><div className="modal-heading"><div><h2 id="customer-import-title">Import customers</h2><p>Review the rows before adding them to your list.</p></div><button className="icon-button" aria-label="Close import preview" disabled={importing} onClick={() => setImportOpen(false)}><X size={18}/></button></div><div className="import-summary"><strong>{importRows.filter(row => !row.issue).length} ready to import</strong><span>{importRows.filter(row => row.issue).length} skipped (invalid name or duplicate contact details)</span></div><div className="import-preview"><div className="import-preview-head"><span>Name</span><span>Email</span><span>Phone</span></div>{importRows.slice(0, 8).map((row, index) => <div className={`import-preview-row ${row.issue ? 'invalid' : ''}`} title={row.issue} key={`${row.name}-${index}`}><span>{row.name || '—'}</span><span>{row.email || '—'}</span><span>{row.phone || '—'}</span></div>)}</div>{importRows.length > 8 && <p className="import-more">Showing 8 of {importRows.length} rows.</p>}{importError && <p className="form-error" role="alert">{importError}</p>}<p className="import-format-help">Expected columns: <strong>Name</strong>, <strong>Email</strong>, <strong>Phone</strong>, and optional <strong>Notes</strong>. Only Name is required.</p><div className="modal-actions"><button type="button" className="secondary-button" disabled={importing} onClick={() => setImportOpen(false)}>Cancel</button><button type="button" className="primary-button" disabled={importing || importRows.every(row => row.issue)} onClick={() => void importCustomers()}>{importing ? 'Importing…' : 'Import customers'}</button></div></section></div>}
  </>;
}
