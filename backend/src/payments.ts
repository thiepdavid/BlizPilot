import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordInvoicePayment } from './invoices.js';

export interface PaymentRecord {
  id: string;
  businessId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Card' | 'Bank transfer' | 'Other';
  receivedAt: string;
}

const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/payments.json');
let pendingWrite = Promise.resolve();

async function readStore(): Promise<PaymentRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as PaymentRecord[]; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '[]\n', 'utf8');
    return [];
  }
}

export async function listPayments(): Promise<PaymentRecord[]> {
  return (await readStore()).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function createPayment(input: { invoiceId: string; amount: number; method: PaymentRecord['method'] }): Promise<PaymentRecord> {
  let created!: PaymentRecord;
  const task = pendingWrite.then(async () => {
    const payments = await readStore();
    const updated = await recordInvoicePayment(input.invoiceId, input.amount);
    created = { id: crypto.randomUUID(), businessId: updated.businessId, invoiceId: updated.id, invoiceNumber: updated.invoiceNumber, customerName: updated.customerName, amount: input.amount, method: input.method, receivedAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify([...payments, created], null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
  return created;
}
