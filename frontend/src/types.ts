export type NavKey = 'Home' | 'Customers' | 'Services' | 'Inventory' | 'Appointments' | 'Billing' | 'Payments' | 'Expenses' | 'Reports' | 'Marketing' | 'AI' | 'Business Profile' | 'Settings' | 'Help Centre';
export type BusinessType = 'boutique' | 'restaurant' | 'salon' | 'grocery' | 'electronics' | 'pharmacy' | 'other';
export interface InventoryItem { id: string; name: string; category: string; sku: string; size: string; color: string; costPrice: number; sellingPrice: number; quantity: number; lowStockAt: number; createdAt: string }
export interface Customer { id: string; name: string; initials: string; email: string; phone?: string; notes?: string; visits: number; lastVisit: string; tone: string }
export interface Appointment { id: string; customerId: string; customer: string; service: string; startsAt: string; durationMinutes: number; status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'No show'; initials: string; tone: string }
export interface InvoiceLineItem { description: string; quantity: number; unitPrice: number; total: number; inventoryItemId?: string; costPrice?: number }
export interface Invoice { id: string; invoiceNumber: string; customerId: string; customerName: string; description: string; items?: InvoiceLineItem[]; amount: number; subtotal?: number; tax?: number; paidAmount: number; dueDate: string; status: 'Unpaid' | 'Partially paid' | 'Paid'; createdAt: string }
export interface Payment { id: string; invoiceId: string; invoiceNumber: string; customerName: string; amount: number; method: 'Cash' | 'UPI' | 'Card' | 'Bank transfer' | 'Other'; receivedAt: string }
export interface Service { id: string; name: string; description: string; durationMinutes: number; price: number; isActive: boolean; createdAt: string }
export interface Campaign { id: string; name: string; channel: string; message: string; status: 'draft'; createdAt: string }
export interface Expense { id: string; description: string; category: string; amount: number; spentAt: string; createdAt: string }
export interface Metric { label: string; value: string; change: string; direction: 'up' | 'down' | 'flat'; icon: 'sales' | 'appointments' | 'pending' | 'customers' | 'expenses' }
