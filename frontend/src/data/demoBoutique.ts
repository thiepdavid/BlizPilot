import type { Appointment, Campaign, Customer, Expense, InventoryItem, Invoice, Payment, Service } from '../types';

// Fictional, read-only sample records for product previews. Never represents a real shop or customer.
const day = (offset: number, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, offset === 0 ? 30 : 0, 0, 0);
  return date;
};
const iso = (offset: number, hour = 12) => day(offset, hour).toISOString();
const dateOnly = (offset: number) => {
  const date = day(offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const demoBusiness = {
  businessName: 'Thread & Loom Boutique',
  fullName: 'Demo Owner',
  currencyCode: 'INR' as const,
  businessType: 'boutique' as const,
  country: 'India',
  addressLine1: 'Demo Market Road',
  city: 'Rajkot',
  district: 'Rajkot',
  region: 'Gujarat',
  postalCode: '360001',
  taxId: '',
};

export const demoCustomers: Customer[] = [
  { id: 'demo-customer-1', name: 'Aarohi Shah', initials: 'AS', email: 'aarohi@example.invalid', visits: 6, lastVisit: 'Today', tone: 'peach', notes: 'Prefers cotton fabrics and size M.' },
  { id: 'demo-customer-2', name: 'Meera Joshi', initials: 'MJ', email: 'meera@example.invalid', visits: 3, lastVisit: 'Yesterday', tone: 'lilac', notes: 'Interested in hand-block prints.' },
  { id: 'demo-customer-3', name: 'Kavya Patel', initials: 'KP', email: 'kavya@example.invalid', visits: 2, lastVisit: 'Oct 6', tone: 'mint', notes: 'Alteration pickup expected this week.' },
  { id: 'demo-customer-4', name: 'Nisha Trivedi', initials: 'NT', email: 'nisha@example.invalid', visits: 1, lastVisit: 'Oct 2', tone: 'blue' },
];

export const demoInventory: InventoryItem[] = [
  { id: 'demo-stock-1', name: 'Indigo Block-Print Kurta', category: 'Kurtas', sku: 'TL-KUR-IND-M', size: 'M', color: 'Indigo', costPrice: 850, sellingPrice: 1499, quantity: 12, lowStockAt: 4, createdAt: iso(-20) },
  { id: 'demo-stock-2', name: 'Indigo Block-Print Kurta', category: 'Kurtas', sku: 'TL-KUR-IND-L', size: 'L', color: 'Indigo', costPrice: 850, sellingPrice: 1499, quantity: 3, lowStockAt: 4, createdAt: iso(-20) },
  { id: 'demo-stock-3', name: 'Cotton Anarkali Dress', category: 'Dresses', sku: 'TL-DRS-CRM-M', size: 'M', color: 'Cream', costPrice: 1250, sellingPrice: 2299, quantity: 8, lowStockAt: 3, createdAt: iso(-18) },
  { id: 'demo-stock-4', name: 'Linen Trousers', category: 'Trousers', sku: 'TL-TRS-SND-30', size: '30', color: 'Sand', costPrice: 700, sellingPrice: 1299, quantity: 7, lowStockAt: 3, createdAt: iso(-15) },
  { id: 'demo-stock-5', name: 'Everyday Cotton Dupatta', category: 'Accessories', sku: 'TL-DUP-ROS-OS', size: 'One size', color: 'Rose', costPrice: 300, sellingPrice: 599, quantity: 2, lowStockAt: 3, createdAt: iso(-12) },
];

export const demoServices: Service[] = [
  { id: 'demo-service-1', name: 'Garment alteration', description: 'Basic fit adjustment for boutique purchases.', durationMinutes: 30, price: 250, isActive: true, createdAt: iso(-30) },
  { id: 'demo-service-2', name: 'Blouse stitching', description: 'Custom blouse stitching appointment.', durationMinutes: 90, price: 850, isActive: true, createdAt: iso(-30) },
  { id: 'demo-service-3', name: 'Pickup & fitting', description: 'Fitting appointment for an order in progress.', durationMinutes: 20, price: 0, isActive: true, createdAt: iso(-30) },
];

export const demoAppointments: Appointment[] = [
  { id: 'demo-appointment-1', customerId: 'demo-customer-1', customer: 'Aarohi Shah', service: 'Pickup & fitting', startsAt: iso(0, 11), durationMinutes: 20, status: 'Confirmed', initials: 'AS', tone: 'peach' },
  { id: 'demo-appointment-2', customerId: 'demo-customer-2', customer: 'Meera Joshi', service: 'Blouse stitching', startsAt: iso(0, 15), durationMinutes: 90, status: 'Pending', initials: 'MJ', tone: 'lilac' },
  { id: 'demo-appointment-3', customerId: 'demo-customer-3', customer: 'Kavya Patel', service: 'Garment alteration', startsAt: iso(2, 13), durationMinutes: 30, status: 'Confirmed', initials: 'KP', tone: 'mint' },
  { id: 'demo-appointment-4', customerId: 'demo-customer-4', customer: 'Nisha Trivedi', service: 'Pickup & fitting', startsAt: iso(-3, 16), durationMinutes: 20, status: 'Completed', initials: 'NT', tone: 'blue' },
];

export const demoInvoices: Invoice[] = [
  { id: 'demo-invoice-1', invoiceNumber: 'TL-2026-0108', customerId: 'demo-customer-1', customerName: 'Aarohi Shah', description: 'Kurta and dupatta', items: [{ description: 'Indigo Block-Print Kurta · M', quantity: 1, unitPrice: 1499, total: 1499, inventoryItemId: 'demo-stock-1', costPrice: 850 }, { description: 'Everyday Cotton Dupatta · Rose', quantity: 1, unitPrice: 599, total: 599, inventoryItemId: 'demo-stock-5', costPrice: 300 }], amount: 2098, subtotal: 2098, tax: 0, paidAmount: 1000, dueDate: dateOnly(5), status: 'Partially paid', createdAt: iso(-1, 10) },
  { id: 'demo-invoice-2', invoiceNumber: 'TL-2026-0107', customerId: 'demo-customer-2', customerName: 'Meera Joshi', description: 'Cotton Anarkali Dress', items: [{ description: 'Cotton Anarkali Dress · M · Cream', quantity: 1, unitPrice: 2299, total: 2299, inventoryItemId: 'demo-stock-3', costPrice: 1250 }], amount: 2299, subtotal: 2299, tax: 0, paidAmount: 2299, dueDate: dateOnly(-3), status: 'Paid', createdAt: iso(-4, 14) },
  { id: 'demo-invoice-3', invoiceNumber: 'TL-2026-0106', customerId: 'demo-customer-3', customerName: 'Kavya Patel', description: 'Linen Trousers and alteration', items: [{ description: 'Linen Trousers · 30 · Sand', quantity: 1, unitPrice: 1299, total: 1299, inventoryItemId: 'demo-stock-4', costPrice: 700 }, { description: 'Garment alteration', quantity: 1, unitPrice: 250, total: 250 }], amount: 1549, subtotal: 1549, tax: 0, paidAmount: 0, dueDate: dateOnly(-1), status: 'Unpaid', createdAt: iso(-2, 12) },
];

export const demoPayments: Payment[] = [
  { id: 'demo-payment-1', invoiceId: 'demo-invoice-1', invoiceNumber: 'TL-2026-0108', customerName: 'Aarohi Shah', amount: 1000, method: 'UPI', receivedAt: iso(-1, 10) },
  { id: 'demo-payment-2', invoiceId: 'demo-invoice-2', invoiceNumber: 'TL-2026-0107', customerName: 'Meera Joshi', amount: 2299, method: 'Card', receivedAt: iso(-4, 14) },
];

export const demoExpenses: Expense[] = [
  { id: 'demo-expense-1', description: 'October boutique rent', category: 'Rent', amount: 18000, spentAt: dateOnly(-6), createdAt: iso(-6) },
  { id: 'demo-expense-2', description: 'Cotton and lining fabric restock', category: 'Inventory / supplies', amount: 7200, spentAt: dateOnly(-4), createdAt: iso(-4) },
  { id: 'demo-expense-3', description: 'Local delivery and packaging', category: 'Transport', amount: 950, spentAt: dateOnly(-2), createdAt: iso(-2) },
];

export const demoCampaigns: Campaign[] = [
  { id: 'demo-campaign-1', name: 'Festive cotton arrivals', channel: 'WhatsApp', message: 'New cotton and hand-block print styles are now in store. Visit Thread & Loom Boutique to explore the collection.', status: 'draft', createdAt: iso(-1) },
  { id: 'demo-campaign-2', name: 'Alteration pickup reminder', channel: 'Email', message: 'Your fitting is ready. Please contact the boutique to arrange a convenient pickup time.', status: 'draft', createdAt: iso(-2) },
];
