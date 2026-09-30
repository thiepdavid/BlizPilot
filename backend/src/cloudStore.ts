import type { BusinessContext } from './supabase.js';

type Row = Record<string, any>;
function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data.');
  return result.data;
}
function invoiceView(row: Row) {
  const amount = Number(row.total);
  const paidAmount = Number(row.paid_amount ?? 0);
  return { id: row.id, businessId: row.business_id, invoiceNumber: row.invoice_number, customerId: row.customer_id, customerName: row.customers?.full_name ?? 'Customer', description: row.description, amount, subtotal: Number(row.subtotal ?? amount), tax: Number(row.tax ?? 0), paidAmount, dueDate: row.due_date, status: paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partially paid' : 'Unpaid', createdAt: row.created_at };
}

export async function cloudListCustomers(context: BusinessContext) {
  const data = check(await context.client.from('customers').select('id,business_id,full_name,email,phone,created_at').eq('business_id', context.businessId).order('created_at', { ascending: false }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, name: row.full_name, email: row.email ?? '', phone: row.phone ?? '', visits: 0, lastVisit: '—', createdAt: row.created_at }));
}

export async function cloudCreateCustomer(context: BusinessContext, input: { name: string; email: string; phone: string }) {
  const data = check(await context.client.from('customers').insert({ business_id: context.businessId, full_name: input.name, email: input.email || null, phone: input.phone || null }).select('id,business_id,full_name,email,phone,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.full_name, email: data.email ?? '', phone: data.phone ?? '', visits: 0, lastVisit: '—', createdAt: data.created_at };
}

export async function cloudListAppointments(context: BusinessContext) {
  const data = check(await context.client.from('appointments').select('id,business_id,customer_id,service_name,starts_at,status,duration_minutes,created_at,customers(full_name)').eq('business_id', context.businessId).order('starts_at', { ascending: true }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, customerId: row.customer_id, customerName: row.customers?.full_name ?? 'Customer', service: row.service_name ?? 'Service', startsAt: row.starts_at, durationMinutes: row.duration_minutes ?? 45, status: row.status === 'completed' ? 'Completed' : row.status === 'pending' ? 'Pending' : row.status === 'cancelled' ? 'Cancelled' : row.status === 'no_show' ? 'No show' : 'Confirmed', createdAt: row.created_at }));
}

export async function cloudCreateAppointment(context: BusinessContext, input: { customerId: string; service: string; startsAt: string; durationMinutes: number }) {
  const { data: customer, error: customerError } = await context.client.from('customers').select('id').eq('id', input.customerId).eq('business_id', context.businessId).maybeSingle();
  if (customerError || !customer) throw new Error('Choose a customer from your customer list.');
  const starts = new Date(input.startsAt);
  const ends = new Date(starts.getTime() + input.durationMinutes * 60_000);
  const { data: conflicts, error: conflictError } = await context.client.from('appointments').select('id').eq('business_id', context.businessId).lt('starts_at', ends.toISOString()).gt('ends_at', starts.toISOString()).neq('status', 'cancelled').neq('status', 'no_show').limit(1);
  if (conflictError) throw new Error(conflictError.message);
  if (conflicts?.length) throw new Error('This time overlaps another appointment. Choose another slot.');
  const data = check(await context.client.from('appointments').insert({ business_id: context.businessId, customer_id: input.customerId, service_name: input.service, duration_minutes: input.durationMinutes, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: 'confirmed' }).select('id,business_id,customer_id,service_name,starts_at,status,customers(full_name)').single()) as Row;
  return { id: data.id, businessId: data.business_id, customerId: data.customer_id, customerName: data.customers?.full_name ?? 'Customer', service: data.service_name, startsAt: data.starts_at, durationMinutes: input.durationMinutes, status: 'Confirmed', createdAt: data.created_at };
}

export async function cloudListInvoices(context: BusinessContext) {
  const data = check(await context.client.from('invoices').select('id,business_id,invoice_number,customer_id,description,subtotal,tax,total,paid_amount,due_date,status,created_at,customers(full_name)').eq('business_id', context.businessId).order('created_at', { ascending: false }));
  return data.map((row: Row) => invoiceView(row));
}

export async function cloudCreateInvoice(context: BusinessContext, input: { customerId: string; description: string; amount: number; gstRate: number; dueDate: string }) {
  const { data: customer, error: customerError } = await context.client.from('customers').select('id').eq('id', input.customerId).eq('business_id', context.businessId).maybeSingle();
  if (customerError || !customer) throw new Error('Choose a customer from your customer list.');
  const year = new Date().getFullYear();
  const tax = Math.round(input.amount * input.gstRate) / 100;
  const total = input.amount + tax;
  const invoiceNumber = `BP-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const data = check(await context.client.from('invoices').insert({ business_id: context.businessId, customer_id: input.customerId, invoice_number: invoiceNumber, description: input.description, subtotal: input.amount, tax, total, due_date: input.dueDate, status: 'sent' }).select('id,business_id,invoice_number,customer_id,description,subtotal,tax,total,paid_amount,due_date,status,created_at,customers(full_name)').single()) as Row;
  return invoiceView(data);
}

export async function cloudListPayments(context: BusinessContext) {
  const data = check(await context.client.from('payments').select('id,business_id,invoice_id,amount,method,paid_at,invoices(invoice_number),customers(full_name)').eq('business_id', context.businessId).order('paid_at', { ascending: false }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, invoiceId: row.invoice_id, invoiceNumber: row.invoices?.invoice_number ?? 'Invoice', customerName: row.customers?.full_name ?? 'Customer', amount: Number(row.amount), method: ({ cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other' } as Record<string, string>)[row.method] ?? 'Other', receivedAt: row.paid_at }));
}

export async function cloudCreatePayment(context: BusinessContext, input: { invoiceId: string; amount: number; method: string }) {
  const method = ({ Cash: 'cash', UPI: 'upi', Card: 'card', 'Bank transfer': 'bank_transfer', Other: 'other' } as Record<string, string>)[input.method] ?? 'other';
  const data = check(await context.client.rpc('record_bizpilot_payment', { target_invoice_id: input.invoiceId, payment_amount: input.amount, payment_method: method })) as Row;
  return data;
}

export async function cloudListServices(context: BusinessContext) {
  const data = check(await context.client.from('services').select('id,business_id,name,description,duration_minutes,price,is_active,created_at').eq('business_id', context.businessId).eq('is_active', true).order('name'));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, name: row.name, description: row.description ?? '', durationMinutes: row.duration_minutes, price: Number(row.price), isActive: row.is_active, createdAt: row.created_at }));
}

export async function cloudCreateService(context: BusinessContext, input: { name: string; description: string; durationMinutes: number; price: number }) {
  const data = check(await context.client.from('services').insert({ business_id: context.businessId, name: input.name, description: input.description || null, duration_minutes: input.durationMinutes, price: input.price }).select('id,business_id,name,description,duration_minutes,price,is_active,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, description: data.description ?? '', durationMinutes: data.duration_minutes, price: Number(data.price), isActive: data.is_active, createdAt: data.created_at };
}

export async function cloudListExpenses(context: BusinessContext) {
  const data = check(await context.client.from('expenses').select('id,business_id,description,category,amount,spent_at,created_at').eq('business_id', context.businessId).order('spent_at', { ascending: false }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, description: row.description, category: row.category ?? '', amount: Number(row.amount), spentAt: row.spent_at, createdAt: row.created_at }));
}

export async function cloudCreateExpense(context: BusinessContext, input: { description: string; category: string; amount: number; spentAt: string }) {
  const data = check(await context.client.from('expenses').insert({ business_id: context.businessId, description: input.description, category: input.category || null, amount: input.amount, spent_at: input.spentAt }).select('id,business_id,description,category,amount,spent_at,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, description: data.description, category: data.category ?? '', amount: Number(data.amount), spentAt: data.spent_at, createdAt: data.created_at };
}

export async function cloudUpdateAppointmentStatus(context: BusinessContext, appointmentId: string, status: string) {
  const dbStatus = ({ Confirmed: 'confirmed', Pending: 'pending', Completed: 'completed', Cancelled: 'cancelled', 'No show': 'no_show' } as Record<string, string>)[status];
  if (!dbStatus) throw new Error('Choose a valid appointment status.');
  const data = check(await context.client.from('appointments').update({ status: dbStatus, updated_at: new Date().toISOString() }).eq('id', appointmentId).eq('business_id', context.businessId).select('id,business_id,customer_id,service_name,starts_at,status,duration_minutes,created_at,customers(full_name)').maybeSingle()) as Row;
  return { id: data.id, businessId: data.business_id, customerId: data.customer_id, customerName: data.customers?.full_name ?? 'Customer', service: data.service_name ?? 'Service', startsAt: data.starts_at, durationMinutes: data.duration_minutes ?? 45, status, createdAt: data.created_at };
}

export async function cloudUpdateAppointmentSchedule(context: BusinessContext, appointmentId: string, startsAt: string, durationMinutes: number) {
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60_000).toISOString();
  const { data: conflicts, error: conflictError } = await context.client.from('appointments').select('id').eq('business_id', context.businessId).neq('id', appointmentId).lt('starts_at', endsAt).gt('ends_at', startsAt).neq('status', 'cancelled').neq('status', 'no_show').limit(1);
  if (conflictError) throw new Error(conflictError.message);
  if (conflicts?.length) throw new Error('This time overlaps another appointment. Choose another slot.');
  const data = check(await context.client.from('appointments').update({ starts_at: startsAt, ends_at: endsAt, duration_minutes: durationMinutes, updated_at: new Date().toISOString() }).eq('id', appointmentId).eq('business_id', context.businessId).select('id,business_id,customer_id,service_name,starts_at,status,duration_minutes,created_at,customers(full_name)').single()) as Row;
  const status = data.status === 'completed' ? 'Completed' : data.status === 'pending' ? 'Pending' : data.status === 'cancelled' ? 'Cancelled' : data.status === 'no_show' ? 'No show' : 'Confirmed';
  return { id: data.id, businessId: data.business_id, customerId: data.customer_id, customerName: data.customers?.full_name ?? 'Customer', service: data.service_name ?? 'Service', startsAt: data.starts_at, durationMinutes: data.duration_minutes ?? durationMinutes, status, createdAt: data.created_at };
}

export async function cloudUpdateCustomer(context: BusinessContext, customerId: string, input: { name: string; email: string; phone: string }) {
  const data = check(await context.client.from('customers').update({ full_name: input.name, email: input.email || null, phone: input.phone || null, updated_at: new Date().toISOString() }).eq('id', customerId).eq('business_id', context.businessId).select('id,business_id,full_name,email,phone,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.full_name, email: data.email ?? '', phone: data.phone ?? '', visits: 0, lastVisit: '—', createdAt: data.created_at };
}

export async function cloudUpdateBusinessProfile(context: BusinessContext, input: { businessName: string; fullName: string }) {
  const business = check(await context.client.from('businesses').update({ name: input.businessName, updated_at: new Date().toISOString() }).eq('id', context.businessId).select('id,name').single()) as Row;
  const profile = check(await context.client.from('users').update({ full_name: input.fullName, updated_at: new Date().toISOString() }).eq('id', context.userId).select('id,full_name').single()) as Row;
  return { businessName: business.name, fullName: profile.full_name };
}

export async function cloudListCampaigns(context: BusinessContext) {
  const data = check(await context.client.from('campaigns').select('id,business_id,name,channel,message,status,created_at').eq('business_id', context.businessId).order('created_at', { ascending: false }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, name: row.name, channel: row.channel, message: row.message, status: row.status, createdAt: row.created_at }));
}
export async function cloudCreateCampaign(context: BusinessContext, input: { name: string; channel: string; message: string }) {
  const data = check(await context.client.from('campaigns').insert({ business_id: context.businessId, name: input.name, channel: input.channel, message: input.message, status: 'draft' }).select('id,business_id,name,channel,message,status,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, channel: data.channel, message: data.message, status: data.status, createdAt: data.created_at };
}

export async function cloudUpdateCampaign(context: BusinessContext, campaignId: string, input: { name: string; channel: string; message: string }) {
  const data = check(await context.client.from('campaigns').update({ name: input.name, channel: input.channel, message: input.message, updated_at: new Date().toISOString() }).eq('id', campaignId).eq('business_id', context.businessId).eq('status', 'draft').select('id,business_id,name,channel,message,status,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, channel: data.channel, message: data.message, status: data.status, createdAt: data.created_at };
}

export async function cloudDeleteCampaign(context: BusinessContext, campaignId: string) {
  const { data, error } = await context.client.from('campaigns').delete().eq('id', campaignId).eq('business_id', context.businessId).eq('status', 'draft').select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Draft not found.');
}

export async function cloudUpdateService(context: BusinessContext, serviceId: string, input: { name: string; description: string; durationMinutes: number; price: number }) {
  const data = check(await context.client.from('services').update({ name: input.name, description: input.description || null, duration_minutes: input.durationMinutes, price: input.price, updated_at: new Date().toISOString() }).eq('id', serviceId).eq('business_id', context.businessId).select('id,business_id,name,description,duration_minutes,price,is_active,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, description: data.description ?? '', durationMinutes: data.duration_minutes, price: Number(data.price), isActive: data.is_active, createdAt: data.created_at };
}

export async function cloudArchiveService(context: BusinessContext, serviceId: string) {
  check(await context.client.from('services').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', serviceId).eq('business_id', context.businessId).eq('is_active', true));
}
