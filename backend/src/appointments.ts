import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCustomers } from './customers.js';

export interface AppointmentRecord {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  service: string;
  startsAt: string;
  durationMinutes: number;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'No show';
  createdAt: string;
}

const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/appointments.json');
const today = new Date();
const at = (hour: number, minute: number) => { const date = new Date(today); date.setHours(hour, minute, 0, 0); return date.toISOString(); };
const seed: AppointmentRecord[] = [
  { id: 'sample-appt-1', businessId: 'demo-business', customerId: 'demo-1', customerName: 'Ananya Sharma', service: 'Haircut & styling', startsAt: at(9, 30), durationMinutes: 45, status: 'Completed', createdAt: new Date().toISOString() },
  { id: 'sample-appt-2', businessId: 'demo-business', customerId: 'demo-2', customerName: 'Rohan Mehta', service: 'Beard trim', startsAt: at(10, 30), durationMinutes: 30, status: 'Confirmed', createdAt: new Date().toISOString() },
  { id: 'sample-appt-3', businessId: 'demo-business', customerId: 'demo-3', customerName: 'Priya Kapoor', service: 'Hair colour', startsAt: at(11, 15), durationMinutes: 90, status: 'Confirmed', createdAt: new Date().toISOString() },
];
let pendingWrite = Promise.resolve();
const assertNoConflict = (appointments: AppointmentRecord[], startsAt: string, durationMinutes: number, skipId?: string) => {
  const start = new Date(startsAt).getTime(); const end = start + durationMinutes * 60_000;
  const conflict = appointments.some(item => item.id !== skipId && !['Cancelled', 'No show'].includes(item.status) && start < new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 && end > new Date(item.startsAt).getTime());
  if (conflict) throw new Error('This time overlaps another appointment. Choose another slot.');
};

async function readStore(): Promise<AppointmentRecord[]> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as AppointmentRecord[]; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
    return seed;
  }
}

export async function listAppointments(): Promise<AppointmentRecord[]> {
  return (await readStore()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function createAppointment(input: { customerId: string; service: string; startsAt: string; durationMinutes: number }): Promise<AppointmentRecord> {
  const customers = await listCustomers();
  const customer = customers.find(item => item.id === input.customerId);
  if (!customer) throw new Error('Choose a customer from your customer list.');
  let created!: AppointmentRecord;
  pendingWrite = pendingWrite.then(async () => {
    const appointments = await readStore();
    assertNoConflict(appointments, input.startsAt, input.durationMinutes);
    created = { id: crypto.randomUUID(), businessId: customer.businessId, customerId: customer.id, customerName: customer.name, service: input.service, startsAt: input.startsAt, durationMinutes: input.durationMinutes, status: 'Confirmed', createdAt: new Date().toISOString() };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify([...appointments, created], null, 2)}\n`, 'utf8');
  });
  await pendingWrite;
  return created;
}

export async function updateAppointmentStatus(id: string, status: AppointmentRecord['status']): Promise<AppointmentRecord> {
  let updated!: AppointmentRecord;
  const task = pendingWrite.then(async () => {
    const appointments = await readStore();
    const index = appointments.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Appointment not found.');
    updated = { ...appointments[index], status };
    appointments[index] = updated;
    await writeFile(filePath, `${JSON.stringify(appointments, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined);
  await task;
  return updated;
}

export async function updateAppointmentSchedule(id: string, startsAt: string, durationMinutes: number): Promise<AppointmentRecord> {
  let updated!: AppointmentRecord;
  const task = pendingWrite.then(async () => {
    const appointments = await readStore();
    const index = appointments.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Appointment not found.');
    assertNoConflict(appointments, startsAt, durationMinutes, id);
    updated = { ...appointments[index], startsAt, durationMinutes };
    appointments[index] = updated;
    await writeFile(filePath, `${JSON.stringify(appointments, null, 2)}\n`, 'utf8');
  });
  pendingWrite = task.then(() => undefined, () => undefined); await task; return updated;
}
