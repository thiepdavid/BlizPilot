import { useEffect, useState, type FormEvent } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { currencyName, supportedCurrencies, type CurrencyCode } from '../lib/currency';
import { countryCode, countryFields, countryOptions } from '../lib/countryProfile';
import './settings.css';

export type BusinessLocation = {
  country: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  taxId: string;
};

type BusinessProfileInput = BusinessLocation & {
  businessName: string;
  fullName: string;
  currencyCode: CurrencyCode;
};

export function SettingsPage({ businessName, fullName, currencyCode, location, onSave }: {
  businessName: string;
  fullName: string;
  currencyCode: CurrencyCode;
  location: BusinessLocation;
  onSave: (input: BusinessProfileInput) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState<CurrencyCode>(currencyCode);
  const [countryDraft, setCountryDraft] = useState(() => countryCode(location.country));
  useEffect(() => setCurrencyDraft(currencyCode), [currencyCode]);
  useEffect(() => setCountryDraft(countryCode(location.country)), [location.country]);
  const fields = countryFields(countryDraft);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setMessage(''); setError('');
    try {
      await onSave({
        businessName: String(data.get('businessName') ?? '').trim(),
        fullName: String(data.get('fullName') ?? '').trim(),
        currencyCode: currencyDraft,
        country: String(data.get('country') ?? '').trim(),
        addressLine1: String(data.get('addressLine1') ?? '').trim(),
        city: String(data.get('city') ?? '').trim(),
        region: String(data.get('region') ?? '').trim(),
        postalCode: String(data.get('postalCode') ?? '').trim(),
        taxId: String(data.get('taxId') ?? '').trim(),
      });
      setMessage('Your profile was saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading section-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> SETTINGS</div><h1>Settings</h1><p>Manage your business profile and owner details.</p></div></div>
    <section className="panel settings-panel">
      <div className="settings-heading"><div className="settings-icon"><Building2 size={18}/></div><div><h2>Business profile</h2><p>These details can appear on printed invoices.</p></div></div>
      <form onSubmit={submit}>
        <label>Business name<span className="settings-input-icon"><Building2 size={14}/></span><input name="businessName" required minLength={2} defaultValue={businessName}/></label>
        <label>Owner name<span className="settings-input-icon"><UserRound size={14}/></span><input name="fullName" required minLength={2} defaultValue={fullName}/></label>
        <label>Business currency<select value={currencyDraft} onChange={event => setCurrencyDraft(event.target.value as CurrencyCode)}>{supportedCurrencies.map(code => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</select></label>
        <p className="settings-help">Currency applies to business records. It does not convert existing amounts, and is locked after you add prices or financial records.</p>
        <div className="settings-location-fields">
          <label>Country or region<select name="country" value={countryDraft} onChange={event => setCountryDraft(event.target.value)}><option value="">Select a country or region</option>{countryOptions.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          <label>Business address<input name="addressLine1" maxLength={200} defaultValue={location.addressLine1} placeholder="Street address" autoComplete="street-address"/></label>
          <div className="settings-address-row">
            <label>City or town<input name="city" maxLength={100} defaultValue={location.city} autoComplete="address-level2"/></label>
            <label>{fields.regionLabel}<input name="region" maxLength={100} defaultValue={location.region} autoComplete="address-level1"/></label>
          </div>
          <label>{fields.postalLabel}<input name="postalCode" maxLength={30} defaultValue={location.postalCode} autoComplete="postal-code"/></label>
          <label>{fields.taxLabel} <span>(optional)</span><input name="taxId" maxLength={100} defaultValue={location.taxId} placeholder={fields.taxLabel}/><small>{fields.taxHint}</small></label>
        </div>
        <p className="settings-help">Field names adapt to the selected country. Whether an address detail or tax number is legally required depends on your business and registration; BizPilot doesn’t determine or validate local tax obligations.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="settings-success" role="status">{message}</p>}
        <div className="modal-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
      </form>
    </section>
  </>;
}
