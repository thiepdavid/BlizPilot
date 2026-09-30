import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CustomerRecord {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  visits: number;
  lastVisit: string;
  createdAt: string;
}

const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/customers.json');
const seed: CustomerRecord[] = [
  { id: 'demo-1', businessId: 'demo-business', name: 'Ananya Sharma', email: 'ananya.s@email.com', phone: '', notes: '', visits: 12, lastVisit: 'Today', createdAt: new Date().toISOString() },
  { id: 'demo-2', businessId: 'demo-business', name: 'Rohan Mehta', email: 'rohan.m@email.com', phone: '', notes: '', visits: 8, lastVisit: 'Yesterday', createdAt: new Date().toISOString() },
  { id: 'demo-3', businessId: 'demo-business', name: 'Priya Kapoor', email: 'priya.k@email.com', phone: '', notes: '', visits: 15, lastVisit: 'Sep 24', createdAt: new Date().toISOString() },
  { id: 'demo-4', businessId: 'demo-business', name: 'Arjun Patel', email: 'arjun.p@email.com', phone: '', notes: '', visits: 3, lastVisit: 'Sep 22', createdAt: new Date().toISOString() },
];
let pendingWrite = Promise.resolve();

async function readStore(): Promise<CustomerRecord[]> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as CustomerRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
    return seed;
  }
}

export async function listCustomers(): Promise<CustomerRecord[]> {
  return readStore();
}

export async function createCustomer(input: Pick<CustomerRecord, 'name' | 'email' | 'phone'> & Partial<Pick<CustomerRecord, 'notes'>>): Promise<CustomerRecord> {
  let created!: CustomerRecord;
  pendingWrite = pendingWrite.then(async () => {
    const customers = await readStore();
    created = { id: crypto.randomUUID(), businessId: 'demo-business', ...input, notes: input.notes ?? '', visits: 0, lastVisit: '—', createdAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify([...customers, created], null, 2)}\n`, 'utf8');
  });
  await pendingWrite;
  return created;
}

export async function updateCustomer(id: string, input: { name: string; email: string; phone: string; notes?: string }): Promise<CustomerRecord> {
  let updated!: CustomerRecord;
  const task = pendingWrite.then(async () => {
    const customers = await readStore();
    const index = customers.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Customer not found.');
    updated = { ...customers[index], ...input, notes: input.notes ?? customers[index].notes ?? '' }; customers[index] = updated;
    await writeFile(filePath, `${JSON.stringify(customers, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return updated;
}
