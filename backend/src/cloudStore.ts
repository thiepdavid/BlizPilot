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
  const items = Array.isArray(row.line_items) ? row.line_items : undefined;
  return { id: row.id, businessId: row.business_id, invoiceNumber: row.invoice_number, customerId: row.customer_id, customerName: row.customers?.full_name ?? 'Customer', description: row.description, items, amount, subtotal: Number(row.subtotal ?? amount), tax: Number(row.tax ?? 0), paidAmount, dueDate: row.due_date, status: paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partially paid' : 'Unpaid', createdAt: row.created_at };
}

export async function cloudListCustomers(context: BusinessContext) {
  const data = check(await context.client.from('customers').select('id,business_id,full_name,email,phone,notes,created_at').eq('business_id', context.businessId).order('created_at', { ascending: false }));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, name: row.full_name, email: row.email ?? '', phone: row.phone ?? '', notes: row.notes ?? '', visits: 0, lastVisit: '—', createdAt: row.created_at }));
}

export async function cloudCreateCustomer(context: BusinessContext, input: { name: string; email: string; phone: string; notes?: string }) {
  const data = check(await context.client.from('customers').insert({ business_id: context.businessId, full_name: input.name, email: input.email || null, phone: input.phone || null, notes: input.notes ?? '' }).select('id,business_id,full_name,email,phone,notes,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.full_name, email: data.email ?? '', phone: data.phone ?? '', notes: data.notes ?? '', visits: 0, lastVisit: '—', createdAt: data.created_at };
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
  const data = check(await context.client.from('invoices').select('id,business_id,invoice_number,customer_id,description,line_items,subtotal,tax,total,paid_amount,due_date,status,created_at,customers(full_name)').eq('business_id', context.businessId).order('created_at', { ascending: false }));
  return data.map((row: Row) => invoiceView(row));
}

export async function cloudCreateInvoice(context: BusinessContext, input: { customerId: string; description: string; items?: { description: string; quantity: number; unitPrice: number; total: number; inventoryItemId?: string }[]; amount: number; taxRate: number; dueDate: string }) {
  const invoiceItems = input.items?.length ? input.items : [{ description: input.description, quantity: 1, unitPrice: input.amount, total: input.amount }];
  const id = check(await context.client.rpc('create_bizpilot_invoice_with_inventory', {
    target_customer_id: input.customerId,
    target_description: input.description,
    target_items: invoiceItems,
    target_tax_rate: input.taxRate,
    target_due_date: input.dueDate,
  })) as string;
  const created = (await cloudListInvoices(context)).find(invoice => invoice.id === id);
  if (!created) throw new Error('The invoice was created but could not be reloaded. Refresh Billing to view it.');
  return created;
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

export async function cloudListInventory(context: BusinessContext) {
  const data = check(await context.client.from('inventory_items').select('id,business_id,name,category,sku,size,color,cost_price,selling_price,quantity,low_stock_at,created_at').eq('business_id', context.businessId).order('name'));
  return data.map((row: Row) => ({ id: row.id, businessId: row.business_id, name: row.name, category: row.category ?? '', sku: row.sku ?? '', size: row.size ?? '', color: row.color ?? '', costPrice: Number(row.cost_price), sellingPrice: Number(row.selling_price), quantity: Number(row.quantity), lowStockAt: Number(row.low_stock_at), createdAt: row.created_at }));
}

export async function cloudCreateInventoryItem(context: BusinessContext, input: { name: string; category: string; sku: string; size: string; color: string; costPrice: number; sellingPrice: number; quantity: number; lowStockAt: number }) {
  const data = check(await context.client.from('inventory_items').insert({ business_id: context.businessId, name: input.name, category: input.category, sku: input.sku, size: input.size, color: input.color, cost_price: input.costPrice, selling_price: input.sellingPrice, quantity: input.quantity, low_stock_at: input.lowStockAt }).select('id,business_id,name,category,sku,size,color,cost_price,selling_price,quantity,low_stock_at,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, category: data.category ?? '', sku: data.sku ?? '', size: data.size ?? '', color: data.color ?? '', costPrice: Number(data.cost_price), sellingPrice: Number(data.selling_price), quantity: Number(data.quantity), lowStockAt: Number(data.low_stock_at), createdAt: data.created_at };
}

export async function cloudUpdateInventoryStock(context: BusinessContext, id: string, quantity: number) {
  const data = check(await context.client.from('inventory_items').update({ quantity, updated_at: new Date().toISOString() }).eq('id', id).eq('business_id', context.businessId).select('id,business_id,name,category,sku,size,color,cost_price,selling_price,quantity,low_stock_at,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.name, category: data.category ?? '', sku: data.sku ?? '', size: data.size ?? '', color: data.color ?? '', costPrice: Number(data.cost_price), sellingPrice: Number(data.selling_price), quantity: Number(data.quantity), lowStockAt: Number(data.low_stock_at), createdAt: data.created_at };
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

export async function cloudDeleteAppointment(context: BusinessContext, appointmentId: string) {
  const { data, error } = await context.client.from('appointments').delete().eq('id', appointmentId).eq('business_id', context.businessId).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Appointment not found.');
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

export async function cloudUpdateCustomer(context: BusinessContext, customerId: string, input: { name: string; email: string; phone: string; notes?: string }) {
  const data = check(await context.client.from('customers').update({ full_name: input.name, email: input.email || null, phone: input.phone || null, notes: input.notes ?? '', updated_at: new Date().toISOString() }).eq('id', customerId).eq('business_id', context.businessId).select('id,business_id,full_name,email,phone,notes,created_at').single()) as Row;
  return { id: data.id, businessId: data.business_id, name: data.full_name, email: data.email ?? '', phone: data.phone ?? '', notes: data.notes ?? '', visits: 0, lastVisit: '—', createdAt: data.created_at };
}

export async function cloudDeleteCustomer(context: BusinessContext, customerId: string) {
  const [appointments, invoices] = await Promise.all([
    context.client.from('appointments').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId).eq('customer_id', customerId),
    context.client.from('invoices').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId).eq('customer_id', customerId),
  ]);
  if (appointments.error) throw new Error(appointments.error.message);
  if (invoices.error) throw new Error(invoices.error.message);
  if ((appointments.count ?? 0) > 0 || (invoices.count ?? 0) > 0) throw new Error('This customer has appointment or invoice history. Keep the customer record to preserve that history.');
  const { data, error } = await context.client.from('customers').delete().eq('id', customerId).eq('business_id', context.businessId).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Customer not found. Refresh the list and try again.');
}

export async function cloudGetBusinessProfile(context: BusinessContext) {
  const business = check(await context.client.from('businesses').select('name,currency_code,business_type,country,address_line1,city,district,region,postal_code,tax_id').eq('id', context.businessId).single()) as Row;
  const profile = check(await context.client.from('users').select('full_name').eq('id', context.userId).single()) as Row;
  return { businessName: business.name, fullName: profile.full_name ?? '', currencyCode: business.currency_code ?? 'INR', businessType: business.business_type ?? 'other', country: business.country ?? '', addressLine1: business.address_line1 ?? '', city: business.city ?? '', district: business.district ?? '', region: business.region ?? '', postalCode: business.postal_code ?? '', taxId: business.tax_id ?? '' };
}

export async function cloudUpdateBusinessProfile(context: BusinessContext, input: { businessName: string; fullName: string; currencyCode: string; businessType: string; country: string; addressLine1: string; city: string; district: string; region: string; postalCode: string; taxId: string }) {
  const current = check(await context.client.from('businesses').select('currency_code').eq('id', context.businessId).single()) as Row;
  if ((current.currency_code ?? 'INR') !== input.currencyCode) {
    const checks = await Promise.all([
      context.client.from('services').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId),
      context.client.from('invoices').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId),
      context.client.from('payments').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId),
      context.client.from('expenses').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId),
      context.client.from('inventory_items').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId),
    ]);
    const failed = checks.find(result => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    if (checks.some(result => (result.count ?? 0) > 0)) throw new Error('Business currency is locked after prices or financial records have been added. Existing amounts are not converted.');
  }
  const business = check(await context.client.from('businesses').update({ name: input.businessName, currency_code: input.currencyCode, business_type: input.businessType, country: input.country || null, address_line1: input.addressLine1 || null, city: input.city || null, district: input.district || null, region: input.region || null, postal_code: input.postalCode || null, tax_id: input.taxId || null, updated_at: new Date().toISOString() }).eq('id', context.businessId).select('id,name,currency_code,business_type,country,address_line1,city,district,region,postal_code,tax_id').single()) as Row;
  const profile = check(await context.client.from('users').update({ full_name: input.fullName, updated_at: new Date().toISOString() }).eq('id', context.userId).select('id,full_name').single()) as Row;
  return { businessName: business.name, fullName: profile.full_name, currencyCode: business.currency_code, businessType: business.business_type ?? 'other', country: business.country ?? '', addressLine1: business.address_line1 ?? '', city: business.city ?? '', district: business.district ?? '', region: business.region ?? '', postalCode: business.postal_code ?? '', taxId: business.tax_id ?? '' };
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
