import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Download, Plus, ReceiptText, X } from 'lucide-react';
import type { Expense } from '../types';
import './expenses.css';
const today = () => new Date().toISOString().slice(0, 10);
export function ExpensePage({ expenses, onCreate }: { expenses: Expense[]; onCreate: (input: { description: string; category: string; amount: number; spentAt: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  function exportExpensesCsv() {
    const csvCell = (value: string | number) => {
      const text = String(value);
      const safeText = /^\s*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Date', 'Description', 'Category', 'Amount', 'Currency'],
      ...expenses.map(expense => [expense.spentAt, expense.description, expense.category || 'Uncategorized', expense.amount.toFixed(2), getBusinessCurrencyCode()]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizpilot-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); setError('');
    try { await onCreate({ description: String(data.get('description') ?? '').trim(), category: String(data.get('category') ?? '').trim(), amount: Number(data.get('amount')), spentAt: String(data.get('spentAt') ?? '') }); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this expense.'); }
    finally { setSaving(false); }
  }
  return <><div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> EXPENSES</div><h1>Expenses</h1><p>Record business costs and keep an eye on spending.</p></div><div className="expense-page-actions"><button type="button" className="secondary-button" title="Download expense records as a CSV file" onClick={exportExpensesCsv} disabled={expenses.length === 0}><Download size={15}/>Export CSV</button><button className="primary-button" onClick={() => { setError(''); setOpen(true); }}><Plus size={17}/>Add expense</button></div></div>
    <div className="invoice-summary"><div className="panel invoice-summary-card"><span>Total recorded</span><strong>{formatCurrency(total)}</strong><small>{expenses.length} expenses in this workspace</small></div></div>
    <section className="panel section-table"><div className="table-toolbar"><strong>Recent expenses</strong><span>{expenses.length} records</span></div><div className="table-header expense-table"><span>DESCRIPTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{expenses.map(expense => <div className="table-row expense-table" key={expense.id}><span className="expense-title"><ReceiptText size={15}/><strong>{expense.description}</strong></span><span>{expense.category || 'Uncategorized'}</span><span><CalendarDays size={13}/>{new Date(`${expense.spentAt}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><strong>{formatCurrency(expense.amount)}</strong></div>)}{!expenses.length && <div className="invoice-empty"><div><ReceiptText size={20}/></div><strong>No expenses yet</strong><span>Record your first business expense to start tracking costs.</span><button className="text-button" onClick={() => setOpen(true)}>Add an expense <Plus size={15}/></button></div>}</section>
    {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title"><div className="modal-heading"><div><h2 id="expense-form-title">Add an expense</h2><p>Keep a record of a business cost.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setOpen(false)}><X size={18}/></button></div><form onSubmit={submit}><label>Description<input name="description" required minLength={2} autoFocus placeholder="e.g. Shampoo supplies"/></label><label>Category <span>(optional)</span><select name="category" defaultValue=""><option value="">Choose a category</option><option>Supplies</option><option>Rent</option><option>Utilities</option><option>Travel</option><option>Marketing</option><option>Equipment</option><option>Other</option></select></label><label>Amount ({getBusinessCurrencyCode()})<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Date<input name="spentAt" type="date" defaultValue={today()} max={today()} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button></div></form></section></div>}</>;
}
