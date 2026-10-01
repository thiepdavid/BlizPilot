import { Activity, CalendarDays, CircleDollarSign, Users, WalletCards } from 'lucide-react';
import type { Metric } from '../types';

const iconMap = { sales: CircleDollarSign, appointments: CalendarDays, pending: Activity, customers: Users, expenses: WalletCards };
export function MetricCard({ metric }: { metric: Metric }) { const Icon = iconMap[metric.icon]; return <article className="metric-card"><div className="metric-top"><span>{metric.label}</span><span className={`metric-icon ${metric.icon}`}><Icon size={17}/></span></div><strong className="metric-value">{metric.value}</strong><div className="metric-change"><span className={metric.direction === 'up' ? 'positive' : metric.direction === 'down' ? 'attention' : ''}>{metric.direction === 'up' ? '↗ ' : metric.direction === 'down' ? '• ' : ''}{metric.change}</span></div></article>; }
