import type { Appointment, Customer } from '../types';


export const appointments: Appointment[] = [
  { id: '1', customerId: 'demo-1', customer: 'Ananya Sharma', service: 'Haircut & styling', startsAt: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(), durationMinutes: 45, status: 'Completed', initials: 'AS', tone: 'peach' },
  { id: '2', customerId: 'demo-2', customer: 'Rohan Mehta', service: 'Beard trim', startsAt: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(), durationMinutes: 30, status: 'Confirmed', initials: 'RM', tone: 'blue' },
  { id: '3', customerId: 'demo-3', customer: 'Priya Kapoor', service: 'Hair colour', startsAt: new Date(new Date().setHours(11, 15, 0, 0)).toISOString(), durationMinutes: 90, status: 'Confirmed', initials: 'PK', tone: 'lilac' },
  { id: '4', customerId: 'demo-4', customer: 'Arjun Patel', service: 'Classic haircut', startsAt: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(), durationMinutes: 45, status: 'Pending', initials: 'AP', tone: 'mint' },
];

export const customers: Customer[] = [
  { id: '1', name: 'Ananya Sharma', initials: 'AS', email: 'ananya.s@email.com', visits: 12, lastVisit: 'Today', tone: 'peach' },
  { id: '2', name: 'Rohan Mehta', initials: 'RM', email: 'rohan.m@email.com', visits: 8, lastVisit: 'Yesterday', tone: 'blue' },
  { id: '3', name: 'Priya Kapoor', initials: 'PK', email: 'priya.k@email.com', visits: 15, lastVisit: 'Sep 24', tone: 'lilac' },
  { id: '4', name: 'Arjun Patel', initials: 'AP', email: 'arjun.p@email.com', visits: 3, lastVisit: 'Sep 22', tone: 'mint' },
];
