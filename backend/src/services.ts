import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ServiceRecord { id: string; businessId: string; name: string; description: string; durationMinutes: number; price: number; isActive: boolean; createdAt: string }
const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/services.json');
let pendingWrite = Promise.resolve();
async function readStore(): Promise<ServiceRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as ServiceRecord[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, '[]\n', 'utf8'); return []; }
}
export async function listServices() { return (await readStore()).filter(service => service.isActive).sort((a, b) => a.name.localeCompare(b.name)); }
export async function createService(input: { name: string; description: string; durationMinutes: number; price: number }): Promise<ServiceRecord> {
  let created!: ServiceRecord;
  const task = pendingWrite.then(async () => {
    const services = await readStore();
    created = { id: crypto.randomUUID(), businessId: 'demo-business', ...input, isActive: true, createdAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify([...services, created], null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
  return created;
}

export async function updateService(id: string, input: { name: string; description: string; durationMinutes: number; price: number }): Promise<ServiceRecord> {
  let updated!: ServiceRecord;
  const task = pendingWrite.then(async () => { const services = await readStore(); const index = services.findIndex(item => item.id === id); if (index < 0) throw new Error('Service not found.'); updated = { ...services[index], ...input }; services[index] = updated; await writeFile(filePath, `${JSON.stringify(services, null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return updated;
}

export async function archiveService(id: string): Promise<void> {
  const task = pendingWrite.then(async () => {
    const services = await readStore();
    const service = services.find(item => item.id === id && item.isActive);
    if (!service) throw new Error('Service not found.');
    service.isActive = false;
    await writeFile(filePath, `${JSON.stringify(services, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
}
