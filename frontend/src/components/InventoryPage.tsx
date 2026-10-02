import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Box, Download, PackagePlus, Pencil, Search, Shirt, Upload, X } from 'lucide-react';
import { formatCurrency, getBusinessCurrencyCode } from '../lib/currency';
import type { InventoryItem } from '../types';
import './inventory.css';

type NewItem = Omit<InventoryItem, 'id' | 'createdAt'>;
type InventoryImportRow = NewItem & { issue?: string };
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
  return rows;
}
export function InventoryPage({ items, onCreate, onStockChange }: { items: InventoryItem[]; onCreate: (input: NewItem) => Promise<void>; onStockChange: (id: string, quantity: number) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false); const [importRows, setImportRows] = useState<InventoryImportRow[]>([]);
  const [importError, setImportError] = useState(''); const [importing, setImporting] = useState(false); const [importMessage, setImportMessage] = useState('');
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
    const quote = (value: string | number) => { const text = String(value); const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
    const rows = filteredItems.map(item => [item.name, item.category, item.sku, item.size, item.color, item.costPrice, item.sellingPrice, item.quantity, item.lowStockAt]);
    const csv = `\uFEFF${[columns, ...rows].map(row => row.map(quote).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizpilot-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function loadInventoryCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file) return;
    setImportError('');
    void file.text().then(text => {
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('Choose a CSV with a header row and at least one product.');
      if (rows.length > 501) throw new Error('Import up to 500 product variants at a time.');
      const headers = rows[0].map(header => header.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[-_\s]+/g, ' '));
      const col = (...names: string[]) => headers.findIndex(header => names.includes(header));
      const nameIndex = col('product', 'name', 'product name'); const priceIndex = col('selling price', 'price'); const quantityIndex = col('units in stock', 'quantity', 'stock');
      if (nameIndex < 0 || priceIndex < 0 || quantityIndex < 0) throw new Error('CSV needs Product, Selling price, and Units in stock columns. Exported BizPilot inventory files already use these headers.');
      const indexes = { category: col('category'), sku: col('sku'), size: col('size'), color: col('color'), cost: col('cost price', 'cost'), lowStock: col('low stock alert', 'low stock threshold', 'low stock at') };
      const read = (values: string[], index: number, fallback = '') => index < 0 ? fallback : (values[index] ?? '').trim();
      const knownSkus = new Set(items.map(item => item.sku.trim().toLocaleLowerCase()).filter(Boolean));
      const parsed: InventoryImportRow[] = [];
      for (const values of rows.slice(1).filter(values => values.some(value => value.trim()))) {
        const name = read(values, nameIndex); const sku = read(values, indexes.sku);
        const costText = read(values, indexes.cost, '0'); const lowStockText = read(values, indexes.lowStock, '2');
        const costPrice = costText ? Number(costText) : 0; const sellingPrice = Number(read(values, priceIndex)); const quantity = Number(read(values, quantityIndex)); const lowStockAt = lowStockText ? Number(lowStockText) : 2;
        const candidate: InventoryImportRow = { name, category: read(values, indexes.category), sku, size: read(values, indexes.size), color: read(values, indexes.color), costPrice, sellingPrice, quantity, lowStockAt };
        if (name.length < 2) candidate.issue = 'Product name is missing or too short';
        else if ([candidate.category, candidate.sku, candidate.size, candidate.color].some(value => value.length > 100)) candidate.issue = 'Category, SKU, size, and color must be 100 characters or less';
        else if (!priceText || !quantityText || !Number.isFinite(costPrice) || costPrice < 0 || costPrice > 9_999_999_999.99 || !Number.isFinite(sellingPrice) || sellingPrice < 0 || sellingPrice > 9_999_999_999.99) candidate.issue = 'Selling price, and any cost price, must be valid amounts of zero or more';
        else if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(lowStockAt) || lowStockAt < 0) candidate.issue = 'Stock and low-stock alert must be whole numbers of zero or more';
        else if (sku && knownSkus.has(sku.toLocaleLowerCase())) candidate.issue = 'SKU already exists';
        if (sku && !candidate.issue) knownSkus.add(sku.toLocaleLowerCase());
        parsed.push(candidate);
      }
      if (!parsed.length) throw new Error('No product rows were found in the CSV.');
      setImportRows(parsed); setImportError(''); setImportMessage(''); setImportOpen(true);
    }).catch(reason => setImportError(reason instanceof Error ? reason.message : 'Could not read this CSV file.'));
  }
  async function importInventory() {
    const ready = importRows.filter(row => !row.issue); if (!ready.length) return;
    setImporting(true); setImportError(''); let saved = 0;
    try {
      for (const row of ready) { const { issue, ...item } = row; if (issue) continue; await onCreate(item); saved++; }
      setImportOpen(false); setImportRows([]); setImportMessage(`${saved} product variant${saved === 1 ? '' : 's'} imported.`);
    } catch (reason) {
      setImportRows(current => { let completed = saved; return current.filter(row => { if (!row.issue && completed > 0) { completed--; return false; } return true; }); });
      setImportError(`${saved} imported before the next row failed: ${reason instanceof Error ? reason.message : 'Could not save product.'}`);
    }
    finally { setImporting(false); }
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
    {importMessage && <p className="import-success" role="status">{importMessage}</p>}{importError && !importOpen && <p className="form-error" role="alert">{importError}</p>}
    <section className="panel section-table"><div className="table-toolbar inventory-toolbar"><strong>Products and variants</strong><label className="search-field inventory-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, size, color, SKU" aria-label="Search inventory"/></label><span>{filteredItems.length} of {items.length} variants</span><input className="inventory-import-input" type="file" accept=".csv,text/csv" aria-label="Choose inventory CSV" onChange={loadInventoryCsv}/><button className="secondary-button inventory-import-button" type="button" onClick={event => { const input = event.currentTarget.parentElement?.querySelector<HTMLInputElement>(".inventory-import-input"); input?.click(); }}><Upload size={14}/>Import CSV</button><button className="secondary-button inventory-export-button" type="button" onClick={exportInventory} disabled={filteredItems.length === 0}><Download size={14}/>Export CSV</button></div><div className="table-header inventory-table"><span>PRODUCT</span><span>SIZE / COLOR</span><span>SKU</span><span>COST / PRICE</span><span>STOCK</span><span></span></div>{filteredItems.map(item => <div className="table-row inventory-table" key={item.id}><span className="inventory-product"><span className="inventory-product-icon"><Shirt size={15}/></span><span><strong>{item.name}</strong><small>{item.category || 'Uncategorized'}</small></span></span><span>{[item.size, item.color].filter(Boolean).join(' · ') || '—'}</span><span>{item.sku || '—'}</span><span className="inventory-prices"><strong>{formatCurrency(item.sellingPrice)}</strong><small>Cost {formatCurrency(item.costPrice)}</small></span><span><strong className={item.quantity <= item.lowStockAt ? 'inventory-quantity-low' : ''}>{item.quantity}</strong><small>Low at {item.lowStockAt}</small></span><button className="inventory-edit-button" onClick={() => { setError(''); setEditing(item); }} aria-label={`Adjust stock for ${item.name}`}><Pencil size={15}/><span>Stock</span></button></div>)}{items.length === 0 ? <div className="invoice-empty"><div><Box size={20}/></div><strong>No products yet</strong><span>Add a product variant to start tracking sizes, colors, cost, price, and stock.</span><button className="text-button" onClick={() => setOpen(true)}>Add your first product <PackagePlus size={15}/></button></div> : filteredItems.length === 0 && <div className="empty-state">No product variants match “{search}”. Try another name, size, color, category, or SKU.</div>}</section>
    {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-form-title"><div className="modal-heading"><div><h2 id="inventory-form-title">Add a product variant</h2><p>Create one row for each size and color combination.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setOpen(false)}>×</button></div><form onSubmit={addItem}><label>Product name<input name="name" required minLength={2} maxLength={160} autoFocus placeholder="e.g. Black Dress"/></label><div className="inventory-form-grid"><label>Category<input name="category" maxLength={100} placeholder="e.g. Dresses"/></label><label>SKU (optional)<input name="sku" maxLength={100} placeholder="e.g. DRS-BLK-M"/></label><label>Size<input name="size" maxLength={100} placeholder="e.g. M"/></label><label>Color<input name="color" maxLength={100} placeholder="e.g. Black"/></label><label>Cost ({getBusinessCurrencyCode()})<input name="costPrice" type="number" min="0" step="0.01" required defaultValue="0"/></label><label>Selling price ({getBusinessCurrencyCode()})<input name="sellingPrice" type="number" min="0" step="0.01" required placeholder="0.00"/></label><label>Quantity<input name="quantity" type="number" min="0" step="1" required defaultValue="0"/></label><label>Low-stock alert at<input name="lowStockAt" type="number" min="0" step="1" defaultValue="2" required/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save variant'}</button></div></form></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="stock-form-title"><div className="modal-heading"><div><h2 id="stock-form-title">Adjust stock</h2><p>{editing.name}{editing.size ? ` · ${editing.size}` : ''}{editing.color ? ` · ${editing.color}` : ''}</p></div><button className="icon-button" aria-label="Close form" onClick={() => setEditing(null)}>×</button></div><form onSubmit={updateStock}><label>Units currently in stock<input name="quantity" type="number" min="0" step="1" required defaultValue={editing.quantity}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Update stock'}</button></div></form></section></div>}
    {importOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !importing) setImportOpen(false); }}><section className="customer-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-import-title"><div className="modal-heading"><div><h2 id="inventory-import-title">Import product variants</h2><p>Review the CSV rows before adding them to inventory.</p></div><button className="icon-button" aria-label="Close import preview" disabled={importing} onClick={() => setImportOpen(false)}><X size={18}/></button></div><div className="import-summary"><strong>{importRows.filter(row => !row.issue).length} ready to import</strong><span>{importRows.filter(row => row.issue).length} skipped due to missing or invalid data</span></div><div className="inventory-import-preview">{importRows.slice(0, 8).map((row, index) => <div className={`inventory-import-row${row.issue ? ' invalid' : ''}`} key={`${row.sku}-${row.name}-${index}`}><span><strong>{row.name || 'Unnamed product'}</strong><small>{[row.size, row.color].filter(Boolean).join(' · ') || 'No size or color'}{row.sku ? ` · ${row.sku}` : ''}</small></span><span>{Number.isFinite(row.quantity) ? `${row.quantity} units` : 'Invalid stock'}<small>{Number.isFinite(row.sellingPrice) ? formatCurrency(row.sellingPrice) : 'Invalid price'}</small></span>{row.issue && <em>{row.issue}</em>}</div>)}</div>{importRows.length > 8 && <p className="import-more">Showing 8 of {importRows.length} rows.</p>}<p className="import-format-help">Required columns: <strong>Product</strong>, <strong>Selling price</strong>, and <strong>Units in stock</strong>. Category, SKU, Size, Color, Cost price, and Low-stock alert are optional. Exported BizPilot CSVs can be imported directly.</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={importing} onClick={() => setImportOpen(false)}>Cancel</button><button type="button" className="primary-button" disabled={importing || importRows.every(row => row.issue)} onClick={() => void importInventory()}>{importing ? 'Importing…' : `Import ${importRows.filter(row => !row.issue).length} variants`}</button></div></section></div>}
  </>;
}
