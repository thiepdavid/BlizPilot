import { useState, type FormEvent } from 'react';
import { Bell, Building2, KeyRound, LayoutDashboard, ShieldAlert, Settings2 } from 'lucide-react';
import type { NavKey } from '../types';
import './settings.css';

const defaultPages: NavKey[] = ['Home', 'Customers', 'Services', 'Inventory', 'Appointments', 'Billing', 'Payments', 'Expenses', 'Reports', 'Marketing', 'AI'];

export function AppSettingsPage({ defaultPage, onDefaultPageChange, alertsEnabled, onAlertsChange, accountEmail, onOpenBusinessProfile, onUpdatePassword, onDeleteAccount }: {
  defaultPage: NavKey;
  onDefaultPageChange: (page: NavKey) => void;
  alertsEnabled: boolean;
  onAlertsChange: (enabled: boolean) => void;
  accountEmail: string;
  onOpenBusinessProfile: () => void;
  onUpdatePassword?: (password: string) => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
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
        <span className="app-setting-copy"><strong>In-app alerts</strong><small>Show reminders for overdue invoices, pending bookings, and low stock.</small></span>
        <label className="settings-toggle"><input type="checkbox" checked={alertsEnabled} onChange={event => onAlertsChange(event.target.checked)} aria-label="Enable in-app alerts"/><span/></label>
      </div>
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
