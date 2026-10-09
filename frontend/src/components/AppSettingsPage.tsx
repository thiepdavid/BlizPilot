import { useState, type FormEvent } from 'react';
import { Bell, Building2, CreditCard, KeyRound, LayoutDashboard, ShieldAlert, Settings2 } from 'lucide-react';
import type { NavKey } from '../types';
import type { SubscriptionInterval, SubscriptionSummary } from '../types/subscription';
import './settings.css';

const defaultPages: NavKey[] = ['Home', 'Customers', 'Services', 'Inventory', 'Appointments', 'Billing', 'Payments', 'Expenses', 'Reports', 'Marketing', 'AI'];

export function AppSettingsPage({ defaultPage, onDefaultPageChange, alertsEnabled, onAlertsChange, accountEmail, onOpenBusinessProfile, onUpdatePassword, onDeleteAccount, subscription, subscriptionLoading, subscriptionNotice, onChooseSubscription, onManageSubscription }: {
  defaultPage: NavKey;
  onDefaultPageChange: (page: NavKey) => void;
  alertsEnabled: boolean;
  onAlertsChange: (enabled: boolean) => void;
  accountEmail: string;
  onOpenBusinessProfile: () => void;
  onUpdatePassword?: (password: string) => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
  subscription?: SubscriptionSummary | null;
  subscriptionLoading?: boolean;
  subscriptionNotice?: string;
  onChooseSubscription?: (interval: SubscriptionInterval) => Promise<void>;
  onManageSubscription?: () => Promise<void>;
}) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');

  async function runBillingAction(action: () => Promise<void>) {
    setBillingBusy(true); setBillingError('');
    try { await action(); }
    catch (reason) { setBillingError(reason instanceof Error ? reason.message : 'Could not open subscription billing.'); }
    finally { setBillingBusy(false); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaving(true); setPasswordError(''); setPasswordMessage('');
    try {
      await onUpdatePassword?.(password);
      setPassword(''); setPasswordOpen(false); setPasswordMessage('Your password was updated.');
    } catch (reason) { setPasswordError(reason instanceof Error ? reason.message : 'Could not update your password.'); }
    finally { setPasswordSaving(false); }
  }

  return <>
    <div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> SETTINGS</div><h1>Settings</h1><p>Choose how BizPilot behaves for you.</p></div></div>

    <section className="panel settings-panel app-settings-panel">
      <div className="settings-heading"><div className="settings-icon"><Settings2 size={18}/></div><div><h2>App preferences</h2><p>Your opening page and alerts are saved in this browser.</p></div></div>
      <div className="app-setting-row">
        <span className="app-setting-icon"><LayoutDashboard size={17}/></span>
        <span className="app-setting-copy"><strong>Open this page at launch</strong><small>Choose which section opens when you start BizPilot.</small></span>
        <select aria-label="Default opening page" value={defaultPage} onChange={event => onDefaultPageChange(event.target.value as NavKey)}>{defaultPages.map(page => <option key={page} value={page}>{page}</option>)}</select>
      </div>
      <div className="app-setting-row">
        <span className="app-setting-icon"><Bell size={17}/></span>
        <span className="app-setting-copy"><strong>In-app alerts</strong><small>Show overdue invoices and pending bookings. Low-stock alerts are a Pro feature.</small></span>
        <label className="settings-toggle"><input type="checkbox" checked={alertsEnabled} onChange={event => onAlertsChange(event.target.checked)} aria-label="Enable in-app alerts"/><span/></label>
      </div>
    </section>

    <section className="panel settings-panel app-settings-panel subscription-panel" aria-labelledby="subscription-heading">
      <div className="settings-heading"><div className="settings-icon"><CreditCard size={18}/></div><div><h2 id="subscription-heading">Plan and billing</h2><p>Manage the BizPilot subscription for this business. Customer invoice payments remain separate.</p></div></div>
      <div className="subscription-current"><span>Current plan</span><strong>{subscription?.plan === 'pro' ? 'BizPilot Pro' : 'Free'}</strong><small>{subscriptionLoading ? 'Refreshing plan…' : subscription?.status && subscription.status !== 'free' ? `Status: ${subscription.status.replaceAll('_', ' ')}` : 'No paid subscription'}</small></div>
      {subscription?.configured && subscription.plan !== 'pro' && <p className="subscription-note">Free includes core sales, customer, and stock tracking with up to {subscription.features.inventoryVariantLimit ?? 50} product variants. Pro adds unlimited variants, low-stock alerts, and detailed sales and profit reports.</p>}
      {!subscription?.configured && <p className="subscription-note">BizPilot Pro is being prepared. Your current tools remain available while subscription billing is set up.</p>}
      {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && <p className="subscription-note">Pro access is scheduled to end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.</p>}
      {subscriptionNotice && <p className="settings-success" role="status">{subscriptionNotice}</p>}
      {subscriptionLoading && <p className="subscription-note">Loading available plans…</p>}
      {!subscriptionLoading && subscription?.configured && subscription.plan !== 'pro' && <div className="subscription-offers">{subscription.offers.map(offer => <article className="subscription-offer" key={offer.key}><div><strong>{offer.productName}</strong><span>{new Intl.NumberFormat(undefined, { style: 'currency', currency: offer.currency }).format(offer.amount)} / {offer.interval === 'month' ? 'month' : 'year'}</span></div><button type="button" className="primary-button" disabled={billingBusy || !subscription.canManage} onClick={() => void runBillingAction(() => onChooseSubscription?.(offer.interval) ?? Promise.resolve())}>{billingBusy ? 'Opening…' : `Choose ${offer.interval === 'month' ? 'monthly' : 'yearly'}`}</button></article>)}</div>}
      {!subscriptionLoading && !subscription?.configured && <p className="subscription-note">Subscription checkout is not set up yet. BizPilot Pro plans will appear here once billing is configured.</p>}
      {subscription?.hasBillingAccount && subscription.canManage && <button type="button" className="secondary-button subscription-manage" disabled={billingBusy} onClick={() => void runBillingAction(() => onManageSubscription?.() ?? Promise.resolve())}>{billingBusy ? 'Opening…' : 'Manage subscription'}</button>}
      {subscription && !subscription.canManage && <p className="subscription-note">Ask the business owner to manage the subscription.</p>}
      {billingError && <p className="form-error" role="alert">{billingError}</p>}
    </section>

    <section className="panel settings-panel app-settings-panel">
      <div className="settings-heading"><div className="settings-icon"><Building2 size={18}/></div><div><h2>Business profile</h2><p>Business name, owner, country, address, tax details, and currency.</p></div></div>
      <button type="button" className="secondary-button" onClick={onOpenBusinessProfile}>Manage business profile</button>
    </section>

    {accountEmail && <section className="panel settings-panel app-settings-panel">
      <div className="settings-heading"><div className="settings-icon"><KeyRound size={18}/></div><div><h2>Account and security</h2><p>Signed in as {accountEmail}</p></div></div>
      {onUpdatePassword && (!passwordOpen ? <button type="button" className="secondary-button" onClick={() => { setPasswordMessage(''); setPasswordError(''); setPasswordOpen(true); }}>Change password</button> : <form className="settings-password-form" onSubmit={savePassword}>
        <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <div className="settings-delete-actions"><button type="button" className="secondary-button" disabled={passwordSaving} onClick={() => { setPasswordOpen(false); setPassword(''); setPasswordError(''); }}>Cancel</button><button type="submit" className="primary-button" disabled={passwordSaving || password.length < 8}>{passwordSaving ? 'Saving…' : 'Update password'}</button></div>
      </form>)}
      {passwordMessage && <p className="settings-success" role="status">{passwordMessage}</p>}
    </section>}

    {onDeleteAccount && <section className="panel settings-delete-panel" aria-labelledby="delete-account-heading">
      <div><h2 id="delete-account-heading"><ShieldAlert size={15}/> Delete account</h2><p>Permanently remove your sign-in and business data. If you own a shared workspace, transfer ownership before deleting your account.</p></div>
      {!deleteOpen ? <button type="button" className="settings-delete-button" onClick={() => { setDeleteError(''); setDeleteConfirmation(''); setDeleteOpen(true); }}>Delete my account</button> : <div className="settings-delete-confirm">
        <label htmlFor="delete-account-confirmation">Type <strong>DELETE</strong> to confirm<input id="delete-account-confirmation" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} aria-describedby="delete-account-warning"/></label>
        <p id="delete-account-warning">This cannot be undone. You will be signed out, and your sole-member business workspace and its records will be removed.</p>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="settings-delete-actions"><button type="button" className="secondary-button" disabled={deleting} onClick={() => { setDeleteOpen(false); setDeleteConfirmation(''); setDeleteError(''); }}>Cancel</button><button type="button" className="settings-delete-button" disabled={deleting || deleteConfirmation !== 'DELETE'} onClick={async () => { setDeleting(true); setDeleteError(''); try { await onDeleteAccount(); } catch (reason) { setDeleteError(reason instanceof Error ? reason.message : 'Could not delete your account.'); setDeleting(false); } }}>{deleting ? 'Deleting…' : 'Permanently delete account'}</button></div>
      </div>}
    </section>}
  </>;
}
