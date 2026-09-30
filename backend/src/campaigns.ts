import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export interface CampaignRecord { id: string; businessId: string; name: string; channel: string; message: string; status: 'draft'; createdAt: string }
const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/campaigns.json');
let pendingWrite = Promise.resolve();
async function readStore(): Promise<CampaignRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as CampaignRecord[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, '[]\n', 'utf8'); return []; }
}
export async function listCampaigns() { return (await readStore()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export async function createCampaign(input: { name: string; channel: string; message: string }): Promise<CampaignRecord> {
  let created!: CampaignRecord;
  const task = pendingWrite.then(async () => { const campaigns = await readStore(); created = { id: crypto.randomUUID(), businessId: 'demo-business', ...input, status: 'draft', createdAt: new Date().toISOString() }; await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, `${JSON.stringify([...campaigns, created], null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return created;
}

export async function updateCampaign(id: string, input: { name: string; channel: string; message: string }): Promise<CampaignRecord> {
  let updated!: CampaignRecord;
  const task = pendingWrite.then(async () => { const campaigns = await readStore(); const index = campaigns.findIndex(item => item.id === id); if (index < 0) throw new Error('Draft not found.'); updated = { ...campaigns[index], ...input }; campaigns[index] = updated; await writeFile(filePath, `${JSON.stringify(campaigns, null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return updated;
}

export async function deleteCampaign(id: string): Promise<void> {
  const task = pendingWrite.then(async () => { const campaigns = await readStore(); const remaining = campaigns.filter(item => item.id !== id); if (remaining.length === campaigns.length) throw new Error('Draft not found.'); await writeFile(filePath, `${JSON.stringify(remaining, null, 2)}\n`, 'utf8'); });
  pendingWrite = task.then(() => undefined, () => undefined); await task;
}
