import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export interface ExpenseRecord { id: string; businessId: string; description: string; category: string; amount: number; spentAt: string; createdAt: string }
const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/expenses.json');
let pendingWrite = Promise.resolve();
async function readStore(): Promise<ExpenseRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as ExpenseRecord[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, '[]\n', 'utf8'); return []; }
}
export async function listExpenses() { return (await readStore()).sort((a, b) => b.spentAt.localeCompare(a.spentAt)); }
export async function createExpense(input: { description: string; category: string; amount: number; spentAt: string }): Promise<ExpenseRecord> {
  let created!: ExpenseRecord;
  const task = pendingWrite.then(async () => { const expenses = await readStore(); created = { id: crypto.randomUUID(), businessId: 'demo-business', ...input, createdAt: new Date().toISOString() }; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, `${JSON.stringify([...expenses, created], null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return created;
}
