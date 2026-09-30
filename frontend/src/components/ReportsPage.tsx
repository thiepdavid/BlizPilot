import { useMemo, useState } from 'react';
import { ChartNoAxesCombined, CreditCard, Download, ReceiptText } from 'lucide-react';
import type { Expense, Payment } from '../types';
import './reports.css';
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const monthOf = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
export function ReportsPage({ payments, expenses }: { payments: Payment[]; expenses: Expense[] }) {
  const [month, setMonth] = useState(currentMonth());
  const reportPayments = useMemo(() => payments.filter(payment => monthOf(payment.receivedAt) === month), [payments, month]);
  const reportExpenses = useMemo(() => expenses.filter(expense => expense.spentAt.slice(0, 7) === month), [expenses, month]);
  const paid = reportPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const spent = reportExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of reportExpenses) { const name = expense.category || 'Uncategorized'; totals.set(name, (totals.get(name) ?? 0) + expense.amount); }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [reportExpenses]);
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
  function exportCsv() {
    const cell = (value: string | number) => { let text = String(value); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `\"${text.replace(/\"/g, '\"\"')}\"`; };
    const rows = [['Type', 'Date', 'Description', 'Category or method', 'Amount'], ...reportPayments.map(payment => ['Payment', payment.receivedAt.slice(0, 10), payment.invoiceNumber, payment.method, payment.amount] as (string | number)[]), ...reportExpenses.map(expense => ['Expense', expense.spentAt, expense.description, expense.category || 'Uncategorized', expense.amount] as (string | number)[])];
    const csv = '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bizpilot-report-${month}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <><div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> REPORTS</div><h1>Reports</h1><p>A clear monthly view of the money you recorded.</p></div><div className="report-actions"><label className="report-month">Month<input type="month" value={month} max={currentMonth()} onChange={event => setMonth(event.target.value)}/></label><button className="secondary-button report-export" onClick={exportCsv}><Download size={14}/>Export CSV</button></div></div>
    <section className="report-summary"><article className="panel report-card"><span><CreditCard size={14}/> Payments received</span><strong>{inr.format(paid)}</strong><small>{reportPayments.length} payments · {monthLabel}</small></article><article className="panel report-card"><span><ReceiptText size={14}/> Expenses recorded</span><strong>{inr.format(spent)}</strong><small>{reportExpenses.length} expenses · {monthLabel}</small></article><article className="panel report-card"><span><ChartNoAxesCombined size={14}/> Remaining after expenses</span><strong className={paid - spent < 0 ? 'report-negative' : 'report-positive'}>{inr.format(paid - spent)}</strong><small>Recorded payments minus expenses</small></article></section>
    <section className="panel report-category"><div className="report-section-heading"><div><h2>Expenses by category</h2><p>{monthLabel}</p></div><strong>{inr.format(spent)}</strong></div>{categories.map(([category, amount]) => <div className="category-row" key={category}><div><span>{category}</span><strong>{inr.format(amount)}</strong></div><div className="category-track"><i style={{ width: `${spent ? Math.max(3, amount / spent * 100) : 0}%` }}/></div></div>)}{categories.length === 0 && <div className="report-empty">No expenses recorded for {monthLabel}.</div>}</section>
  </>;
}
