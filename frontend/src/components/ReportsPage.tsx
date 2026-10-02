import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import { useMemo, useState } from 'react';
import { ChartNoAxesCombined, CreditCard, Download, ReceiptText } from 'lucide-react';
import type { Appointment, Customer, Expense, Invoice, InventoryItem, Payment } from '../types';
import './reports.css';
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const monthOf = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
export function ReportsPage({ payments, expenses, customers, appointments, invoices, inventory }: { payments: Payment[]; expenses: Expense[]; customers: Customer[]; appointments: Appointment[]; invoices: Invoice[]; inventory: InventoryItem[] }) {
  const [month, setMonth] = useState(currentMonth());
  const previousMonthDate = new Date(`${month}-01T00:00:00`);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${month}-01T00:00:00`);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: date.toLocaleDateString([], { month: 'short' }),
      payments: payments.filter(payment => monthOf(payment.receivedAt) === key).reduce((sum, payment) => sum + payment.amount, 0),
      expenses: expenses.filter(expense => expense.spentAt.slice(0, 7) === key).reduce((sum, expense) => sum + expense.amount, 0),
    };
  });
  const maxTrendValue = Math.max(1, ...trendMonths.flatMap(item => [item.payments, item.expenses]));
  const compactCurrency = (amount: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: getBusinessCurrencyCode(), notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  const reportPayments = useMemo(() => payments.filter(payment => monthOf(payment.receivedAt) === month), [payments, month]);
  const previousMonthPayments = useMemo(() => payments.filter(payment => monthOf(payment.receivedAt) === previousMonth), [payments, previousMonth]);
  const reportExpenses = useMemo(() => expenses.filter(expense => expense.spentAt.slice(0, 7) === month), [expenses, month]);
  const previousMonthExpenses = useMemo(() => expenses.filter(expense => expense.spentAt.slice(0, 7) === previousMonth), [expenses, previousMonth]);
  const reportInvoices = useMemo(() => invoices.filter(invoice => monthOf(invoice.createdAt) === month), [invoices, month]);
  const soldProducts = reportInvoices.flatMap(invoice => invoice.items ?? []).filter(item => item.inventoryItemId);
  const productSales = soldProducts.reduce((sum, item) => sum + item.total, 0);
  const productCost = soldProducts.reduce((sum, item) => sum + (item.costPrice ?? 0) * item.quantity, 0);
  const productGrossProfit = productSales - productCost;
  const productGrossMargin = productSales > 0 ? productGrossProfit / productSales * 100 : 0;
  const categoryPerformance = useMemo(() => {
    const categoryByProduct = new Map(inventory.map(item => [item.id, item.category || 'Uncategorized']));
    const totals = new Map<string, { units: number; revenue: number; cost: number }>();
    for (const invoice of reportInvoices) for (const item of invoice.items ?? []) {
      if (!item.inventoryItemId) continue;
      const category = categoryByProduct.get(item.inventoryItemId) ?? 'Uncategorized';
      const total = totals.get(category) ?? { units: 0, revenue: 0, cost: 0 };
      total.units += item.quantity;
      total.revenue += item.total;
      total.cost += (item.costPrice ?? 0) * item.quantity;
      totals.set(category, total);
    }
    return [...totals.entries()].map(([category, total]) => ({ category, ...total, grossProfit: total.revenue - total.cost, margin: total.revenue > 0 ? (total.revenue - total.cost) / total.revenue * 100 : 0 })).sort((a, b) => b.revenue - a.revenue);
  }, [reportInvoices, inventory]);
  const topCategoryRevenue = categoryPerformance[0]?.revenue ?? 0;
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
  const previousPaid = previousMonthPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const spent = reportExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const previousSpent = previousMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthComparison = (current: number, previous: number) => previous === 0 ? (current === 0 ? 'No activity last month' : 'New this month') : `${Math.abs((current - previous) / previous * 100).toFixed(1)}% ${current >= previous ? 'up' : 'down'} vs last month`;
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
    <section className="report-summary"><article className="panel report-card"><span><CreditCard size={14}/> Payments received</span><strong>{formatCurrency(paid)}</strong><small>{reportPayments.length} payments · {monthLabel}</small><small className="report-comparison">{monthComparison(paid, previousPaid)}</small></article><article className="panel report-card"><span><ReceiptText size={14}/> Expenses recorded</span><strong>{formatCurrency(spent)}</strong><small>{reportExpenses.length} expenses · {monthLabel}</small><small className="report-comparison">{monthComparison(spent, previousSpent)}</small></article><article className="panel report-card"><span><ChartNoAxesCombined size={14}/> Remaining after expenses</span><strong className={paid - spent < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(paid - spent)}</strong><small>Recorded payments minus expenses</small></article><article className="panel report-card"><span><ChartNoAxesCombined size={14}/> Product gross profit</span><strong className={productGrossProfit < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(productGrossProfit)}</strong><small>{productGrossMargin.toFixed(1)}% gross margin · sales less product cost</small></article></section>
    <section className="panel report-category cash-trend-panel"><div className="report-section-heading"><div><h2>Cash trend</h2><p>Payments received and expenses over six months, ending {monthLabel}</p></div></div><div className="cash-trend-legend"><span><i className="cash-trend-payment"/>Payments</span><span><i className="cash-trend-expense"/>Expenses</span></div><div className="cash-trend-chart" role="img" aria-label="Six-month comparison of payments received and expenses"><div className="cash-trend-baseline"/>{trendMonths.map(item => <div className="cash-trend-month" key={item.key}><div className="cash-trend-bars"><div className="cash-trend-bar-wrap" title={`${item.label} payments: ${formatCurrency(item.payments)}`}><small>{compactCurrency(item.payments)}</small><i className="cash-trend-payment" style={{ height: `${item.payments ? Math.max(3, item.payments / maxTrendValue * 100) : 0}%` }}/></div><div className="cash-trend-bar-wrap" title={`${item.label} expenses: ${formatCurrency(item.expenses)}`}><small>{compactCurrency(item.expenses)}</small><i className="cash-trend-expense" style={{ height: `${item.expenses ? Math.max(3, item.expenses / maxTrendValue * 100) : 0}%` }}/></div></div><span>{item.label}</span></div>)}</div></section>
    <section className="panel report-category report-products"><div className="report-section-heading"><div><h2>Best-selling products</h2><p>Ranked by units invoiced · {monthLabel}</p></div><strong>{soldProducts.reduce((sum, item) => sum + item.quantity, 0)} units</strong></div>{bestSellingProducts.map((product, index) => { const grossProfit = product.revenue - product.cost; const grossMargin = product.revenue > 0 ? grossProfit / product.revenue * 100 : 0; return <div className="product-performance-row" key={product.id}><span className="product-rank">{index + 1}</span><div className="product-performance-name"><strong>{product.name}</strong><div className="product-performance-track"><i style={{ width: `${topProductUnits ? Math.max(4, product.units / topProductUnits * 100) : 0}%` }}/></div></div><div className="product-performance-stat"><small>UNITS</small><strong>{product.units}</strong></div><div className="product-performance-stat"><small>SALES</small><strong>{formatCurrency(product.revenue)}</strong></div><div className="product-performance-stat"><small>GROSS PROFIT</small><strong className={grossProfit < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(grossProfit)}</strong><small className={`product-margin ${grossProfit < 0 ? 'report-negative' : 'report-positive'}`}>{grossMargin.toFixed(1)}% margin</small></div></div>; })}{!bestSellingProducts.length && <div className="report-empty">Product sales will appear after you invoice items from Inventory.</div>}</section>
    <section className="panel report-category category-performance-panel"><div className="report-section-heading"><div><h2>Sales by product category</h2><p>Product sales and gross profit · {monthLabel}</p></div><strong>{categoryPerformance.length} categories</strong></div>{categoryPerformance.map(item => <div className="category-performance-row" key={item.category}><div className="category-performance-name"><strong>{item.category}</strong><div className="category-performance-track"><i style={{ width: `${topCategoryRevenue ? Math.max(3, item.revenue / topCategoryRevenue * 100) : 0}%` }}/></div><small>{item.units} units</small></div><div className="category-performance-stat"><small>SALES</small><strong>{formatCurrency(item.revenue)}</strong></div><div className="category-performance-stat"><small>GROSS PROFIT</small><strong className={item.grossProfit < 0 ? 'report-negative' : 'report-positive'}>{formatCurrency(item.grossProfit)}</strong><span className={item.grossProfit < 0 ? 'report-negative' : 'report-positive'}>{item.margin.toFixed(1)}% margin</span></div></div>)}{!categoryPerformance.length && <div className="report-empty">Category performance will appear after you invoice products from Inventory.</div>}</section>
    <section className="panel report-category"><div className="report-section-heading"><div><h2>Expenses by category</h2><p>{monthLabel}</p></div><strong>{formatCurrency(spent)}</strong></div>{categories.map(([category, amount]) => <div className="category-row" key={category}><div><span>{category}</span><strong>{formatCurrency(amount)}</strong></div><div className="category-track"><i style={{ width: `${spent ? Math.max(3, amount / spent * 100) : 0}%` }}/></div></div>)}{categories.length === 0 && <div className="report-empty">No expenses recorded for {monthLabel}.</div>}</section>
  </>;
}
