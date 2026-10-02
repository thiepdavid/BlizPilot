import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Box, Download, PackagePlus, Pencil, Search, Shirt } from 'lucide-react';
import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import type { InventoryItem } from '../types';
import './inventory.css';

type NewItem = Omit<InventoryItem, 'id' | 'createdAt'>;
export function InventoryPage({ items, onCreate, onStockChange }: { items: InventoryItem[]; onCreate: (input: NewItem) => Promise<void>; onStockChange: (id: string, quantity: number) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const lowStock = useMemo(() => items.filter(item => item.quantity <= item.lowStockAt), [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter(item => [item.name, item.category, item.sku, item.size, item.color].some(value => value.toLocaleLowerCase().includes(query)));
  }, [items, search]);
  const units = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const stockCost = useMemo(() => items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0), [items]);
  function exportInventory() {
    const currency = getBusinessCurrencyCode();
    const columns = ['Product', 'Category', 'SKU', 'Size', 'Color', `Cost price (${currency})`, `Selling price (${currency})`, 'Units in stock', 'Low-stock alert'];
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = filteredItems.map(item => [item.name, item.category, item.sku, item.size, item.color, item.costPrice, item.sellingPrice, item.quantity, item.lowStockAt]);
    const csv = `\uFEFF${[columns, ...rows].map(row => row.map(quote).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizpilot-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true); setError('');
    try {
      await onCreate({ name: String(data.get('name') ?? '').trim(), category: String(data.get('category') ?? '').trim(), sku: String(data.get('sku') ?? '').trim(), size: String(data.get('size') ?? '').trim(), color: String(data.get('color') ?? '').trim(), costPrice: Number(data.get('costPrice')), sellingPrice: Number(data.get('sellingPrice')), quantity: Number(data.get('quantity')), lowStockAt: Number(data.get('lowStockAt')) });
      setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this product.'); }
    finally { setSaving(false); }
  }
  async function updateStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; const data = new FormData(event.currentTarget); setSaving(true); setError('');
    try { await onStockChange(editing.id, Number(data.get('quantity'))); setEditing(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update stock.'); }
    finally { setSaving(false); }
  }
  return <>
    <div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> BOUTIQUE</div><h1>Inventory</h1><p>Track clothing products by size and color, and catch low stock early.</p></div><button className="primary-button" onClick={() => { setError(''); setOpen(true); }}><PackagePlus size={17}/>Add product variant</button></div>
    <div className="inventory-summary"><div className="panel inventory-metric"><span>Product variants</span><strong>{items.length}</strong><small>Each size and color combination is tracked separately</small></div><div className="panel inventory-metric"><span>Units in stock</span><strong>{units}</strong><small>Across all variants</small></div><div className="panel inventory-metric"><span>Low stock</span><strong className={lowStock.length ? 'inventory-alert-number' : ''}>{lowStock.length}</strong><small>At or below each item's alert level</small></div><div className="panel inventory-metric"><span>Stock cost value</span><strong>{formatCurrency(stockCost)}</strong><small>Estimated from recorded cost prices</small></div></div>
    {lowStock.length > 0 && <section className="inventory-low-stock" role="status"><AlertTriangle size={17}/><span><strong>{lowStock.length} variant{lowStock.length === 1 ? '' : 's'} need restocking</strong>{lowStock.slice(0, 4).map(item => `${item.name}${item.size ? ` · ${item.size}` : ''}${item.color ? ` · ${item.color}` : ''}: ${item.quantity} left`).join('  •  ')}</span></section>}
    <section className="panel section-table"><div className="table-toolbar inventory-toolbar"><strong>Products and variants</strong><label className="search-field inventory-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, size, color, SKU" aria-label="Search inventory"/></label><span>{filteredItems.length} of {items.length} variants</span><button className="secondary-button inventory-export-button" type="button" onClick={exportInventory} disabled={filteredItems.length === 0}><Download size={14}/>Export CSV</button></div><div className="table-header inventory-table"><span>PRODUCT</span><span>SIZE / COLOR</span><span>SKU</span><span>COST / PRICE</span><span>STOCK</span><span></span></div>{filteredItems.map(item => <div className="table-row inventory-table" key={item.id}><span className="inventory-product"><span className="inventory-product-icon"><Shirt size={15}/></span><span><strong>{item.name}</strong><small>{item.category || 'Uncategorized'}</small></span></span><span>{[item.size, item.color].filter(Boolean).join(' · ') || '—'}</span><span>{item.sku || '—'}</span><span className="inventory-prices"><strong>{formatCurrency(item.sellingPrice)}</strong><small>Cost {formatCurrency(item.costPrice)}</small></span><span><strong className={item.quantity <= item.lowStockAt ? 'inventory-quantity-low' : ''}>{item.quantity}</strong><small>Low at {item.lowStockAt}</small></span><button className="inventory-edit-button" onClick={() => { setError(''); setEditing(item); }} aria-label={`Adjust stock for ${item.name}`}><Pencil size={15}/><span>Stock</span></button></div>)}{items.length === 0 ? <div className="invoice-empty"><div><Box size={20}/></div><strong>No products yet</strong><span>Add a product variant to start tracking sizes, colors, cost, price, and stock.</span><button className="text-button" onClick={() => setOpen(true)}>Add your first product <PackagePlus size={15}/></button></div> : filteredItems.length === 0 && <div className="empty-state">No product variants match “{search}”. Try another name, size, color, category, or SKU.</div>}</section>
    {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-form-title"><div className="modal-heading"><div><h2 id="inventory-form-title">Add a product variant</h2><p>Create one row for each size and color combination.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setOpen(false)}>×</button></div><form onSubmit={addItem}><label>Product name<input name="name" required minLength={2} maxLength={160} autoFocus placeholder="e.g. Black Dress"/></label><div className="inventory-form-grid"><label>Category<input name="category" maxLength={100} placeholder="e.g. Dresses"/></label><label>SKU (optional)<input name="sku" maxLength={100} placeholder="e.g. DRS-BLK-M"/></label><label>Size<input name="size" maxLength={100} placeholder="e.g. M"/></label><label>Color<input name="color" maxLength={100} placeholder="e.g. Black"/></label><label>Cost ({getBusinessCurrencyCode()})<input name="costPrice" type="number" min="0" step="0.01" required defaultValue="0"/></label><label>Selling price ({getBusinessCurrencyCode()})<input name="sellingPrice" type="number" min="0" step="0.01" required placeholder="0.00"/></label><label>Quantity<input name="quantity" type="number" min="0" step="1" required defaultValue="0"/></label><label>Low-stock alert at<input name="lowStockAt" type="number" min="0" step="1" defaultValue="2" required/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save variant'}</button></div></form></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="stock-form-title"><div className="modal-heading"><div><h2 id="stock-form-title">Adjust stock</h2><p>{editing.name}{editing.size ? ` · ${editing.size}` : ''}{editing.color ? ` · ${editing.color}` : ''}</p></div><button className="icon-button" aria-label="Close form" onClick={() => setEditing(null)}>×</button></div><form onSubmit={updateStock}><label>Units currently in stock<input name="quantity" type="number" min="0" step="1" required defaultValue={editing.quantity}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Update stock'}</button></div></form></section></div>}
  </>;
}
