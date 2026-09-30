import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCustomers } from './customers.js';

export interface InvoiceRecord {
  id: string;
  businessId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  description: string;
  amount: number;
  subtotal?: number;
  tax?: number;
  paidAmount: number;
  dueDate: string;
  status: 'Unpaid' | 'Partially paid' | 'Paid';
  createdAt: string;
}

const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/invoices.json');
let pendingWrite = Promise.resolve();

async function readStore(): Promise<InvoiceRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as InvoiceRecord[]; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '[]\n', 'utf8');
    return [];
  }
}

export async function listInvoices(): Promise<InvoiceRecord[]> {
  return (await readStore()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createInvoice(input: { customerId: string; description: string; amount: number; gstRate: number; dueDate: string }): Promise<InvoiceRecord> {
  const customer = (await listCustomers()).find(item => item.id === input.customerId);
  if (!customer) throw new Error('Choose a customer from your customer list.');
  let created!: InvoiceRecord;
  pendingWrite = pendingWrite.then(async () => {
    const invoices = await readStore();
    const year = new Date().getFullYear();
    const sequence = invoices.filter(invoice => invoice.invoiceNumber.startsWith(`BP-${year}-`)).length + 1;
    const tax = Math.round(input.amount * input.gstRate) / 100;
    created = { id: crypto.randomUUID(), businessId: customer.businessId, invoiceNumber: `BP-${year}-${String(sequence).padStart(4, '0')}`, customerId: customer.id, customerName: customer.name, description: input.description, subtotal: input.amount, tax, amount: input.amount + tax, paidAmount: 0, dueDate: input.dueDate, status: 'Unpaid', createdAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify([...invoices, created], null, 2)}\n`, 'utf8');
  });
  await pendingWrite;
  return created;
}

export async function recordInvoicePayment(invoiceId: string, amount: number): Promise<InvoiceRecord> {
  let updated!: InvoiceRecord;
  const task = pendingWrite.then(async () => {
    const invoices = await readStore();
    const index = invoices.findIndex(invoice => invoice.id === invoiceId);
    if (index < 0) throw new Error('Choose an invoice from your billing list.');
    const invoice = invoices[index];
    const paidAmount = invoice.paidAmount ?? 0;
    const remaining = Math.round((invoice.amount - paidAmount) * 100) / 100;
    if (invoice.status === 'Paid' || amount > remaining) throw new Error('Payment exceeds the remaining invoice balance.');
    const nextPaid = Math.round((paidAmount + amount) * 100) / 100;
    updated = { ...invoice, paidAmount: nextPaid, status: nextPaid >= invoice.amount ? 'Paid' : 'Partially paid' };
    invoices[index] = updated;
    await writeFile(filePath, `${JSON.stringify(invoices, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
  return updated;
}
