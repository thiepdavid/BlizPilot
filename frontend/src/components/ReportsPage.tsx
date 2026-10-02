import { formatCurrency } from '../lib/currency';
import { useMemo, useState } from 'react';
import { ChartNoAxesCombined, CreditCard, Download, ReceiptText } from 'lucide-react';
import type { Appointment, Customer, Expense, Invoice, Payment } from '../types';
import './reports.css';
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const monthOf = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
export function ReportsPage({ payments, expenses, customers, appointments, invoices }: { payments: Payment[]; expenses: Expense[]; customers: Customer[]; appointments: Appointment[]; invoices: Invoice[] }) {
  const [month, setMonth] = useState(currentMonth());
  const reportPayments = useMemo(() => payments.filter(payment => monthOf(payment.receivedAt) === month), [payments, month]);
  const reportExpenses = useMemo(() => expenses.filter(expense => expense.spentAt.slice(0, 7) === month), [expenses, month]);
  const reportInvoices = useMemo(() => invoices.filter(invoice => monthOf(invoice.createdAt) === month), [invoices, month]);
  const soldProducts = reportInvoices.flatMap(invoice => invoice.items ?? []).filter(item => item.inventoryItemId);
  const productSales = soldProducts.reduce((sum, item) => sum + item.total, 0);
  const productCost = soldProducts.reduce((sum, item) => sum + (item.costPrice ?? 0) * item.quantity, 0);
  const productGrossProfit = productSales - productCost;
  const productGrossMargin = productSales > 0 ? productGrossProfit / productSales * 100 : 0;
  const bestSellingProducts = useMemo(() => {
    const totals = new Map<string, { id: string; name: string; units: number; revenue: number; cost: number }>();
    for (const invoice of reportInvoices) for (const item of invoice.items ?? []) {
      if (!item.inventoryItemId) continue;
      const product = totals.get(item.inventoryItemId) ?? { id: item.inventoryItemId, name: item.description, units: 0, revenue: 0, cost: 0 };
      product.units += item.quantity;
      product.revenue += item.total;
      product.cost += (item.costPrice ?? 0) * item.quantity;
      totals.set(item.inventoryItemId, product);
    }
    return [...totals.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 8);
  }, [reportInvoices]);
  const topProductUnits = bestSellingProducts[0]?.units ?? 0;
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
    const rows = [['Type', 'Date', 'Description', 'Category or method', 'Amount', 'Gross margin (%)'], ...reportPayments.map(payment => ['Payment', payment.receivedAt.slice(0, 10), payment.invoiceNumber, payment.method, payment.amount, ''] as (string | number)[]), ...reportExpenses.map(expense => ['Expense', expense.spentAt, expense.description, expense.category || 'Uncategorized', expense.amount, ''] as (string | number)[]), ...reportInvoices.flatMap(invoice => (invoice.items ?? []).filter(item => item.inventoryItemId).flatMap(item => { const cost = (item.costPrice ?? 0) * item.quantity; const grossProfit = item.total - cost; const margin = item.total > 0 ? (grossProfit / item.total * 100).toFixed(1) : '0.0'; const date = invoice.createdAt.slice(0, 10); const reference = `${invoice.invoiceNumber} · ${item.description}`; return [['Product sale', date, reference, `${item.quantity} units`, item.total, ''], ['Product cost', date, reference, `${item.quantity} units`, -cost, ''], ['Product gross profit', date, reference, `${item.quantity} units`, grossProfit, margin]] as (string | number)[][]; }))];
    const csv = '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bizpilot-report-${month}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportRecords(filename: string, headers: string[], rows: Array<Array<string | number>>) {
    const cell = (value: string | number) => {
      let text = String(value);
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <><div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> REPORTS</div><h1>Reports</h1><p>A clear monthly view of the money you recorded.</p></div><div className="report-actions"><label className="report-month">Month<input type="month" value={month} max={currentMonth()} onChange={event => setMonth(event.target.value)}/></label><button className="secondary-button report-export" onClick={exportCsv}><Download size={14}/>Export CSV</button></div></div>
    <section className="panel records-export-panel"><div className="records-export-heading"><div><h2>Download business records</h2><p>Save a spreadsheet copy of your customers, appointments, or invoices.</p></div></div><div className="records-export-grid"><button className="secondary-button" onClick={() => exportRecords('bizpilot-customers.csv', ['Name', 'Email', 'Phone', 'Visits', 'Last visit'], customers.map(item => [item.name, item.email, item.phone ?? '', item.visits, item.lastVisit || '']))}><Download size={14}/><span>Customers <small>{customers.length} records</small></span></button><button className="secondary-button" onClick={() => exportRecords('bizpilot-appointments.csv', ['Customer', 'Service', 'Starts at', 'Duration minutes', 'Status'], appointments.map(item => [item.customer, item.service, item.startsAt, item.durationMinutes, item.status]))}><Download size={14}/><span>Appointments <small>{appointments.length} records</small></span></button><button className="secondary-button" onClick={() => exportRecords('bizpilot-invoices.csv', ['Invoice number', 'Customer', 'Description', 'Amount', 'Paid', 'Balance', 'Due date', 'Status'], invoices.map(item => [item.invoiceNumber, item.customerName, item.description, item.amount, item.paidAmount, Math.max(0, item.amount - item.paidAmount), item.dueDate, item.status]))}><Download size={14}/><span>Invoices <small>{invoices.length} records</small></span></button></div></section>
    <section className="report-summary"><article className="panel report-card"><span><CreditCard size={14}/> Payments received</span><strong>{formatCurrency(paid)}</strong><small>{reportPayments.length} payments · {monthLabel}</small></article><article className="panel report-card"><span><ReceiptText size={14}/> Expenses recorded</span><strong>{formatCurrency(spent)}</strong><small>{reportExpenses.length} expenses · {monthLabel}</small></article><article className="panel report-card"><span><ChartNoAxesCombined size={14}/> Remaining after expenses</span><strong className={paid - spent < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(paid - spent)}</strong><small>Recorded payments minus expenses</small></article><article className="panel report-card"><span><ChartNoAxesCombined size={14}/> Product gross profit</span><strong className={productGrossProfit < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(productGrossProfit)}</strong><small>{productGrossMargin.toFixed(1)}% gross margin · sales less product cost</small></article></section>
    <section className="panel report-category report-products"><div className="report-section-heading"><div><h2>Best-selling products</h2><p>Ranked by units invoiced · {monthLabel}</p></div><strong>{soldProducts.reduce((sum, item) => sum + item.quantity, 0)} units</strong></div>{bestSellingProducts.map((product, index) => { const grossProfit = product.revenue - product.cost; const grossMargin = product.revenue > 0 ? grossProfit / product.revenue * 100 : 0; return <div className="product-performance-row" key={product.id}><span className="product-rank">{index + 1}</span><div className="product-performance-name"><strong>{product.name}</strong><div className="product-performance-track"><i style={{ width: `${topProductUnits ? Math.max(4, product.units / topProductUnits * 100) : 0}%` }}/></div></div><div className="product-performance-stat"><small>UNITS</small><strong>{product.units}</strong></div><div className="product-performance-stat"><small>SALES</small><strong>{formatCurrency(product.revenue)}</strong></div><div className="product-performance-stat"><small>GROSS PROFIT</small><strong className={grossProfit < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(grossProfit)}</strong><small className={`product-margin ${grossProfit < 0 ? 'report-negative' : 'report-positive'}`}>{grossMargin.toFixed(1)}% margin</small></div></div>; })}{!bestSellingProducts.length && <div className="report-empty">Product sales will appear after you invoice items from Inventory.</div>}</section>
    <section className="panel report-category"><div className="report-section-heading"><div><h2>Expenses by category</h2><p>{monthLabel}</p></div><strong>{formatCurrency(spent)}</strong></div>{categories.map(([category, amount]) => <div className="category-row" key={category}><div><span>{category}</span><strong>{formatCurrency(amount)}</strong></div><div className="category-track"><i style={{ width: `${spent ? Math.max(3, amount / spent * 100) : 0}%` }}/></div></div>)}{categories.length === 0 && <div className="report-empty">No expenses recorded for {monthLabel}.</div>}</section>
  </>;
}
