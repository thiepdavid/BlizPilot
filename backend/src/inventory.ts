import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InventoryRecord { id: string; businessId: string; name: string; category: string; sku: string; size: string; color: string; costPrice: number; sellingPrice: number; quantity: number; lowStockAt: number; createdAt: string }
const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/inventory.json');
let pendingWrite = Promise.resolve();
async function readStore(): Promise<InventoryRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as InventoryRecord[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, '[]\n', 'utf8'); return []; }
}
export async function listInventory() { return (await readStore()).sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size)); }
export async function createInventoryItem(input: Omit<InventoryRecord, 'id' | 'businessId' | 'createdAt'>): Promise<InventoryRecord> {
  let created!: InventoryRecord;
  const task = pendingWrite.then(async () => { const rows = await readStore();
    if (input.sku && rows.some(row => row.sku.toLowerCase() === input.sku.toLowerCase())) throw new Error('That SKU is already in use.');
    created = { id: crypto.randomUUID(), businessId: 'demo-business', ...input, createdAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, `${JSON.stringify([...rows, created], null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return created;
}
export async function updateInventoryStock(id: string, quantity: number) {
  let updated!: InventoryRecord;
  const task = pendingWrite.then(async () => { const rows = await readStore(); const index = rows.findIndex(row => row.id === id); if (index < 0) throw new Error('Inventory item not found.'); updated = { ...rows[index], quantity }; rows[index] = updated; await writeFile(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return updated;
}

export type InventoryInvoiceLine = { inventoryItemId?: string; description: string; quantity: number; unitPrice: number; total: number; costPrice?: number };
export async function reserveInventoryForInvoice(items: InventoryInvoiceLine[]): Promise<InventoryInvoiceLine[]> {
  let prepared: InventoryInvoiceLine[] = items;
  const linked = items.filter(item => item.inventoryItemId);
  if (!linked.length) return prepared;
  const task = pendingWrite.then(async () => {
    const rows = await readStore();
    const needed = new Map<string, number>();
    for (const item of linked) needed.set(item.inventoryItemId!, (needed.get(item.inventoryItemId!) ?? 0) + item.quantity);
    const variants = new Map<string, InventoryRecord>();
    for (const [id, quantity] of needed) {
      const variant = rows.find(row => row.id === id);
      if (!variant) throw new Error('A selected inventory product could not be found. Refresh Inventory and try again.');
      if (!Number.isInteger(quantity)) throw new Error('Inventory product quantities must be whole numbers.');
      if (variant.quantity < quantity) throw new Error(`Not enough stock for ${variant.name}${variant.size ? ` · ${variant.size}` : ''}${variant.color ? ` · ${variant.color}` : ''}.`);
      variants.set(id, variant);
    }
    prepared = items.map(item => {
      const variant = item.inventoryItemId ? variants.get(item.inventoryItemId) : undefined;
      if (!variant) return item;
      const description = [variant.name, variant.size, variant.color].filter(Boolean).join(' · ');
      const unitPrice = variant.sellingPrice;
      return { ...item, description, unitPrice, total: Math.round(unitPrice * item.quantity * 100) / 100, costPrice: variant.costPrice };
    });
    for (const [id, quantity] of needed) rows.find(item => item.id === id)!.quantity -= quantity;
    await writeFile(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
  return prepared;
}

export async function restoreInventoryForInvoice(items: Array<{ inventoryItemId?: string; quantity: number }>) {
  const task = pendingWrite.then(async () => {
    const rows = await readStore();
    for (const item of items) {
      if (!item.inventoryItemId) continue;
      const row = rows.find(entry => entry.id === item.inventoryItemId);
      if (row) row.quantity += item.quantity;
    }
    await writeFile(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
}
