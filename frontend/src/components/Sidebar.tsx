import { useState } from 'react';
import { Activity, CalendarDays, ChevronDown, CreditCard, LayoutDashboard, Menu, MessageSquareText, Settings, Sparkles, Users, X, Scissors, ReceiptText, ChartNoAxesCombined, Megaphone } from 'lucide-react';
import type { NavKey } from '../types';

const items: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: 'Home', icon: LayoutDashboard }, { label: 'Customers', icon: Users }, { label: 'Services', icon: Scissors }, { label: 'Appointments', icon: CalendarDays },
  { label: 'Billing', icon: CreditCard }, { label: 'Payments', icon: Activity }, { label: 'Expenses', icon: ReceiptText }, { label: 'Reports', icon: ChartNoAxesCombined }, { label: 'Marketing', icon: Megaphone }, { label: 'AI', icon: Sparkles }, { label: 'Settings', icon: Settings },
];

export function Sidebar({ active, onNavigate, businessName, accountName, businessInitial, accountInitial }: { active: NavKey; onNavigate: (key: NavKey) => void; businessName: string; accountName: string; businessInitial: string; accountInitial: string }) {
  const [open, setOpen] = useState(false);
  const nav = <><div className="brand-lockup"><div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div><div><strong>bizpilot</strong><span>BUSINESS MANAGER</span></div></div>
    <button className="business-switch"><div className="shop-avatar">{businessInitial}</div><span><strong>{businessName}</strong><small>Business workspace</small></span><ChevronDown size={16} /></button>
    <div className="nav-caption">WORKSPACE</div><nav>{items.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { onNavigate(label); setOpen(false); }}><Icon size={18} /><span>{label}</span>{label === 'AI' && <span className="new-tag">NEW</span>}</button>)}</nav>
    <div className="sidebar-spacer"/><div className="help-card"><div className="help-icon"><MessageSquareText size={17}/></div><strong>Need a hand?</strong><p>We're here to help you grow.</p><button onClick={() => onNavigate('Settings')}>Visit help centre <span>↗</span></button></div>
    <button className="profile-row"><div className="profile-avatar">{accountInitial}</div><span><strong>{accountName}</strong><small>Business owner</small></span><ChevronDown size={16}/></button></>;
  return <><button aria-label="Open navigation" className="mobile-menu" onClick={() => setOpen(true)}><Menu size={21}/></button>{open && <button aria-label="Close navigation backdrop" className="sidebar-backdrop" onClick={() => setOpen(false)}/>}<aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><button aria-label="Close navigation" className="mobile-close" onClick={() => setOpen(false)}><X size={19}/></button>{nav}</aside></>;
}
