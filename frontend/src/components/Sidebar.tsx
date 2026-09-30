import { useState } from 'react';
import { Activity, CalendarDays, ChevronDown, CreditCard, LayoutDashboard, Menu, MessageSquareText, Settings, Sparkles, Users, X, Scissors, ReceiptText, ChartNoAxesCombined, Megaphone, Building2, LogOut, UserRound } from 'lucide-react';
import type { NavKey } from '../types';
import { ActionMenu } from './ActionMenu';

const items: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: 'Home', icon: LayoutDashboard }, { label: 'Customers', icon: Users }, { label: 'Services', icon: Scissors }, { label: 'Appointments', icon: CalendarDays },
  { label: 'Billing', icon: CreditCard }, { label: 'Payments', icon: Activity }, { label: 'Expenses', icon: ReceiptText }, { label: 'Reports', icon: ChartNoAxesCombined }, { label: 'Marketing', icon: Megaphone }, { label: 'AI', icon: Sparkles }, { label: 'Settings', icon: Settings },
];

export function Sidebar({ active, onNavigate, businessName, accountName, accountEmail, businessInitial, accountInitial, onSignOut }: { active: NavKey; onNavigate: (key: NavKey) => void; businessName: string; accountName: string; accountEmail?: string; businessInitial: string; accountInitial: string; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = (section: NavKey) => { onNavigate(section); setOpen(false); };
  const nav = <><div className="brand-lockup"><div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div><div><strong>bizpilot</strong><span>BUSINESS MANAGER</span></div></div>
    <ActionMenu label="Open business menu" heading="Current business" description="Switching between multiple businesses isn’t available yet." className="sidebar-business-menu" triggerClassName="business-switch" items={[{ label: 'Business profile', description: 'Edit business and owner details', icon: <Building2 size={16}/>, onSelect: () => navigate('Settings') }, { label: 'Go to dashboard', description: 'View today’s business summary', icon: <LayoutDashboard size={16}/>, onSelect: () => navigate('Home') }]} trigger={<><div className="shop-avatar">{businessInitial}</div><span><strong>{businessName}</strong><small>Business workspace</small></span><ChevronDown size={16} /></>}/>
    <div className="nav-caption">WORKSPACE</div><nav>{items.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { onNavigate(label); setOpen(false); }}><Icon size={18} /><span>{label}</span>{label === 'AI' && <span className="new-tag">NEW</span>}</button>)}</nav>
    <div className="sidebar-spacer"/><div className="help-card"><div className="help-icon"><MessageSquareText size={17}/></div><strong>Need a hand?</strong><p>We're here to help you grow.</p><button onClick={() => navigate('Settings')}>Visit help centre <span>↗</span></button></div>
    <ActionMenu label="Open profile menu" heading={accountName} description={accountEmail || 'Business owner'} triggerClassName="profile-row" placement="top" items={[{ label: 'Profile & business settings', description: 'Update your workspace details', icon: <UserRound size={16}/>, onSelect: () => navigate('Settings') }, ...(onSignOut ? [{ label: 'Sign out', description: 'Sign out of this account', icon: <LogOut size={16}/>, onSelect: onSignOut, destructive: true }] : [])]} trigger={<><div className="profile-avatar">{accountInitial}</div><span><strong>{accountName}</strong><small>Business owner</small></span><ChevronDown size={16}/></>}/></>;
  return <><button aria-label="Open navigation" className="mobile-menu" onClick={() => setOpen(true)}><Menu size={21}/></button>{open && <button aria-label="Close navigation backdrop" className="sidebar-backdrop" onClick={() => setOpen(false)}/>}<aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><button aria-label="Close navigation" className="mobile-close" onClick={() => setOpen(false)}><X size={19}/></button>{nav}</aside></>;
}
