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
