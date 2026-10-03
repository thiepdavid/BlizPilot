import { useEffect, useState, type FormEvent } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { currencyName, supportedCurrencies, type CurrencyCode } from '../lib/currency';
import { countryCode, countryFields, countryOptions } from '../lib/countryProfile';
import type { BusinessType } from '../types';
import './settings.css';

export type BusinessLocation = {
  country: string;
  addressLine1: string;
  city: string;
  district: string;
  region: string;
  postalCode: string;
  taxId: string;
};

type BusinessProfileInput = BusinessLocation & {
  businessName: string;
  fullName: string;
  currencyCode: CurrencyCode;
  businessType: BusinessType;
};

type GeoapifyFeature = { properties: {
  place_id?: string; name?: string; formatted?: string; address_line1?: string; housenumber?: string; street?: string; country_code?: string;
  city?: string; town?: string; village?: string; municipality?: string; district?: string; suburb?: string;
  neighbourhood?: string; county?: string; state?: string; province?: string; region?: string; postcode?: string;
} };
type LocationField = 'address' | 'city' | 'district' | 'region' | 'postalCode';

function LocationAutocompleteInput({ field, value, onChange, onChoose, country, apiKey, placeholder, autoComplete }: {
  field: LocationField; value: string; onChange: (value: string) => void;
  onChoose: (feature: GeoapifyFeature) => void; country: string; apiKey: string;
  placeholder?: string; autoComplete: string;
}) {
  const [suggestions, setSuggestions] = useState<GeoapifyFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!apiKey || !country || value.trim().length < 2 || !open) {
      setSuggestions([]); setLoading(false); setError(''); setHasSearched(false); return;
    }
    const controller = new AbortController();
    setSuggestions([]);
    setError('');
    setHasSearched(false);
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        // Keep the typed phrase intact. Adding the current region to every query
        // made partial town/district searches overly strict and hid valid matches.
        const params = new URLSearchParams({ text: value.trim(), filter: `countrycode:${country.toLowerCase()}`, format: 'geojson', limit: '7', apiKey });
        const type = field === 'city' ? 'city' : field === 'district' ? 'locality' : field === 'region' ? 'state' : field === 'postalCode' ? 'postcode' : '';
        if (type) params.set('type', type);
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { message?: string; reason?: string; error?: string };
          const detail = payload.message || payload.reason || payload.error;
          const hint = response.status === 401 || response.status === 403 ? ' Check the key and allowed origins.' : response.status === 429 ? ' Try again later.' : '';
          throw new Error(`Geoapify request failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}${hint}`);
        }
        const result = await response.json() as { features?: GeoapifyFeature[] };
        // Keep only results Geoapify identifies as belonging to the selected country.
        setSuggestions((result.features ?? []).filter(feature => feature.properties.country_code?.toLowerCase() === country.toLowerCase()));
        setHasSearched(true);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setHasSearched(true);
          setError(reason instanceof TypeError ? 'Could not reach Geoapify. Check allowed origins and CORS.' : reason instanceof Error ? reason.message : 'Address search failed.');
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiKey, country, field, open, value]);

  const id = `location-${field}`;
  return <div className="location-autocomplete">
    <input id={id} name={field === 'address' ? 'addressLine1' : field === 'postalCode' ? 'postalCode' : field} maxLength={field === 'postalCode' ? 30 : 200} value={value} onChange={event => { onChange(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} placeholder={placeholder} autoComplete={autoComplete} aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={`${id}-suggestions`}/>
    {open && apiKey && country && value.trim().length >= 2 && (loading || error || hasSearched) && <div className="location-autocomplete-status">
      {loading && <div className="address-search-note" role="status">Looking for matching places…</div>}
      {error && <div className="address-search-error" role="alert">{error}</div>}
      {!loading && !error && hasSearched && suggestions.length === 0 && <div className="address-search-note">No matches found. Try a shorter name or keep typing.</div>}
      {suggestions.length > 0 && <div className="address-suggestions" id={`${id}-suggestions`} role="listbox">{suggestions.map((feature, index) => <button type="button" role="option" key={feature.properties.place_id ?? `${feature.properties.formatted}-${index}`} onMouseDown={event => event.preventDefault()} onClick={() => { onChoose(feature); setSuggestions([]); setOpen(false); }}><strong>{feature.properties.name || feature.properties.address_line1 || feature.properties.formatted}</strong>{feature.properties.formatted && <span>{feature.properties.formatted}</span>}</button>)}</div>}
    </div>}
  </div>;
}

export function SettingsPage({ businessName, fullName, currencyCode, businessType, location, onSave, onDeleteAccount }: {
  businessName: string;
  fullName: string;
  currencyCode: CurrencyCode;
  businessType: BusinessType;
  location: BusinessLocation;
  onSave: (input: BusinessProfileInput) => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState<CurrencyCode>(currencyCode);
  const [businessTypeDraft, setBusinessTypeDraft] = useState<BusinessType>(businessType);
  const [countryDraft, setCountryDraft] = useState(() => countryCode(location.country));
  const [addressLine1, setAddressLine1] = useState(location.addressLine1);
  const [city, setCity] = useState(location.city);
  const [district, setDistrict] = useState(location.district);
  const [region, setRegion] = useState(location.region);
  const [postalCode, setPostalCode] = useState(location.postalCode);
  const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim() ?? '';
  useEffect(() => setCurrencyDraft(currencyCode), [currencyCode]);
  useEffect(() => setBusinessTypeDraft(businessType), [businessType]);
  useEffect(() => setCountryDraft(countryCode(location.country)), [location.country]);
  useEffect(() => {
    setAddressLine1(location.addressLine1); setCity(location.city); setDistrict(location.district);
    setRegion(location.region); setPostalCode(location.postalCode);
  }, [location.addressLine1, location.city, location.district, location.region, location.postalCode]);
  const fields = countryFields(countryDraft);

  function chooseLocation(field: LocationField, feature: GeoapifyFeature) {
    const place = feature.properties;
    if (field === 'address') {
      setAddressLine1(place.address_line1 || [place.housenumber, place.street].filter(Boolean).join(' ') || place.name || '');
      setCity(place.city || place.town || place.village || place.municipality || '');
      setDistrict(place.district || place.suburb || place.neighbourhood || place.county || '');
      setRegion(place.state || place.province || place.region || '');
      setPostalCode(place.postcode || '');
    }
    if (field === 'city') setCity(place.city || place.town || place.village || place.municipality || place.name || '');
    if (field === 'district') setDistrict(place.district || place.suburb || place.neighbourhood || place.county || place.name || '');
    if (field === 'region') setRegion(place.state || place.province || place.region || place.name || '');
    if (field === 'postalCode') setPostalCode(place.postcode || place.name || '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setMessage(''); setError('');
    try {
      await onSave({
        businessName: String(data.get('businessName') ?? '').trim(),
        fullName: String(data.get('fullName') ?? '').trim(),
        currencyCode: currencyDraft,
        businessType: businessTypeDraft,
        country: countryDraft,
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        district: district.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
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
        <label>What type of business do you run?<select value={businessTypeDraft} onChange={event => setBusinessTypeDraft(event.target.value as BusinessType)}><option value="boutique">Boutique / clothing & fashion</option><option value="restaurant">Restaurant / café</option><option value="salon">Salon / personal services</option><option value="grocery">Grocery / convenience store</option><option value="electronics">Electronics</option><option value="pharmacy">Pharmacy</option><option value="other">Other</option></select><small>This helps BizPilot show the tools that fit your business. You can change it later.</small></label>
        <label>Business currency<select value={currencyDraft} onChange={event => setCurrencyDraft(event.target.value as CurrencyCode)}>{supportedCurrencies.map(code => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</select></label>
        <p className="settings-help">Currency applies to business records. It does not convert existing amounts, and is locked after you add prices or financial records.</p>
        <div className="settings-location-fields">
          <label>Country or region<select name="country" value={countryDraft} onChange={event => { setCountryDraft(event.target.value); setAddressLine1(''); setCity(''); setDistrict(''); setRegion(''); setPostalCode(''); }}><option value="">Select a country or region</option>{countryOptions.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          <label>Business address<LocationAutocompleteInput field="address" country={countryDraft} apiKey={geoapifyKey} value={addressLine1} onChange={setAddressLine1} onChoose={feature => chooseLocation('address', feature)} placeholder={countryDraft ? 'Type a street, building, or business' : 'Select a country first'} autoComplete="street-address"/><small>Choose a suggestion to fill the city, region, district, and postal code when available.</small></label>
          <div className="settings-address-row">
            <label>City or town<LocationAutocompleteInput field="city" country={countryDraft} apiKey={geoapifyKey} value={city} onChange={setCity} onChoose={feature => chooseLocation('city', feature)} placeholder={countryDraft ? 'Start typing a city or town' : 'Select a country first'} autoComplete="address-level2"/></label>
            <label>District / county<LocationAutocompleteInput field="district" country={countryDraft} apiKey={geoapifyKey} value={district} onChange={setDistrict} onChoose={feature => chooseLocation('district', feature)} placeholder={countryDraft ? 'Start typing a district' : 'Select a country first'} autoComplete="address-level3"/></label>
          </div>
          <div className="settings-address-row"><label>{fields.regionLabel}<LocationAutocompleteInput field="region" country={countryDraft} apiKey={geoapifyKey} value={region} onChange={setRegion} onChoose={feature => chooseLocation('region', feature)} placeholder={countryDraft ? 'Start typing a region' : 'Select a country first'} autoComplete="address-level1"/></label><label>{fields.postalLabel}<LocationAutocompleteInput field="postalCode" country={countryDraft} apiKey={geoapifyKey} value={postalCode} onChange={setPostalCode} onChoose={feature => chooseLocation('postalCode', feature)} placeholder={countryDraft ? 'Start typing a code' : 'Select a country first'} autoComplete="postal-code"/></label></div>
          <label>{fields.taxLabel} <span>(optional)</span><input name="taxId" maxLength={100} defaultValue={location.taxId} placeholder={fields.taxLabel}/><small>{fields.taxHint}</small></label>
        </div>
        <p className="settings-help">Field names adapt to the selected country. Whether an address detail or tax number is legally required depends on your business and registration; BizPilot doesn’t determine or validate local tax obligations.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="settings-success" role="status">{message}</p>}
        <div className="modal-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
      </form>
    </section>
    {onDeleteAccount && <section className="panel settings-delete-panel" aria-labelledby="delete-account-heading">
      <div><h2 id="delete-account-heading">Delete account</h2><p>Permanently remove your sign-in and business data. Workspaces shared with others are kept, but ownership must be transferred before deleting an owner account.</p></div>
      {!deleteOpen ? <button type="button" className="settings-delete-button" onClick={() => { setDeleteError(''); setDeleteConfirmation(''); setDeleteOpen(true); }}>Delete my account</button> : <div className="settings-delete-confirm">
        <label htmlFor="delete-account-confirmation">Type <strong>DELETE</strong> to confirm<input id="delete-account-confirmation" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} aria-describedby="delete-account-warning"/></label>
        <p id="delete-account-warning">This cannot be undone. You will be signed out, and your sole-member business workspace and its records will be removed.</p>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="settings-delete-actions"><button type="button" className="secondary-button" disabled={deleting} onClick={() => { setDeleteOpen(false); setDeleteConfirmation(''); setDeleteError(''); }}>Cancel</button><button type="button" className="settings-delete-button" disabled={deleting || deleteConfirmation !== 'DELETE'} onClick={async () => { setDeleting(true); setDeleteError(''); try { await onDeleteAccount(); } catch (reason) { setDeleteError(reason instanceof Error ? reason.message : 'Could not delete your account.'); setDeleting(false); } }}>{deleting ? 'Deleting…' : 'Permanently delete account'}</button></div>
      </div>}
    </section>}
  </>;
}
