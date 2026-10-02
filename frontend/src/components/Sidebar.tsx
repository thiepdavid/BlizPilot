import { useState } from 'react';
import { Activity, CalendarDays, ChartNoAxesCombined, ChevronDown, CreditCard, LayoutDashboard, Megaphone, Menu, MessageSquareText, ReceiptText, Scissors, Settings, Shirt, Sparkles, Users, X, Building2 } from 'lucide-react';
import type { BusinessType, NavKey } from '../types';
import { ActionMenu } from './ActionMenu';

const workspaceItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: 'Home', icon: LayoutDashboard }, { label: 'Customers', icon: Users }, { label: 'Services', icon: Scissors }, { label: 'Inventory', icon: Shirt }, { label: 'Appointments', icon: CalendarDays },
];
const financeItems: { label: NavKey; icon: typeof LayoutDashboard }[] = [
  { label: 'Billing', icon: CreditCard }, { label: 'Payments', icon: Activity }, { label: 'Expenses', icon: ReceiptText }, { label: 'Reports', icon: ChartNoAxesCombined }, { label: 'Marketing', icon: Megaphone },
];

export function Sidebar({ active, onNavigate, businessName, businessInitial, businessType }: { active: NavKey; onNavigate: (key: NavKey) => void; businessName: string; businessInitial: string; businessType: BusinessType }) {
  const [open, setOpen] = useState(false);
  const navigate = (section: NavKey) => { onNavigate(section); setOpen(false); };
  const visibleWorkspace = businessType === 'boutique' ? workspaceItems.filter(item => item.label !== 'Services' && item.label !== 'Appointments') : workspaceItems;
  const renderItems = (items: typeof workspaceItems) => <nav>{items.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => navigate(label)}><Icon size={17}/><span>{label}</span>{label === 'AI' && <span className="new-tag">NEW</span>}</button>)}</nav>;
  const nav = <>
    <div className="brand-lockup"><div className="brand-mark"><Activity size={20} strokeWidth={2.5}/></div><div><strong>BizPilot</strong><span>BUSINESS MANAGER</span></div></div>
    <ActionMenu label="Open business menu" heading="Current business" description="Switching between multiple businesses isn’t available yet." className="sidebar-business-menu" triggerClassName="business-switch" items={[{ label: 'Business profile', description: 'Edit business and owner details', icon: <Building2 size={16}/>, onSelect: () => navigate('Settings') }, { label: 'Go to dashboard', description: 'View today’s business summary', icon: <LayoutDashboard size={16}/>, onSelect: () => navigate('Home') }]} trigger={<><div className="shop-avatar">{businessInitial}</div><span><strong>{businessName}</strong><small>Business workspace</small></span><ChevronDown size={16}/></>}/>
    <div className="nav-group"><div className="nav-caption">WORKSPACE</div>{renderItems(visibleWorkspace)}</div>
    <div className="nav-group"><div className="nav-caption">FINANCE</div>{renderItems(financeItems)}</div>
    <div className="nav-group nav-group-tools"><div className="nav-caption">TOOLS</div><nav><button className={`nav-item ${active === 'AI' ? 'active' : ''}`} aria-current={active === 'AI' ? 'page' : undefined} onClick={() => navigate('AI')}><Sparkles size={17}/><span>AI Assistant</span><span className="new-tag">NEW</span></button><button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} aria-current={active === 'Settings' ? 'page' : undefined} onClick={() => navigate('Settings')}><Settings size={17}/><span>Settings</span></button></nav></div>
    <div className="sidebar-spacer"/><div className="help-card"><div className="help-icon"><MessageSquareText size={17}/></div><strong>Need a hand?</strong><p>Find answers and learn how BizPilot works.</p><button onClick={() => navigate('Help Centre')}>Visit help centre <span>↗</span></button></div>
  </>;
  return <><button aria-label="Open navigation" className="mobile-menu" onClick={() => setOpen(true)}><Menu size={21}/></button>{open && <button aria-label="Close navigation backdrop" className="sidebar-backdrop" onClick={() => setOpen(false)}/>}<aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><button aria-label="Close navigation" className="mobile-close" onClick={() => setOpen(false)}><X size={19}/></button>{nav}</aside></>;
}
