import { useEffect, useState, type FormEvent } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { currencyName, supportedCurrencies, type CurrencyCode } from '../lib/currency';
import { countryCode, countryFields, countryOptions } from '../lib/countryProfile';
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
};

type GeoapifyFeature = { properties: {
  place_id: string; name?: string; formatted?: string; address_line1?: string; housenumber?: string; street?: string;
  city?: string; town?: string; village?: string; municipality?: string; district?: string; suburb?: string;
  neighbourhood?: string; county?: string; state?: string; province?: string; region?: string; postcode?: string;
} };

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
  const [addressLine1, setAddressLine1] = useState(location.addressLine1);
  const [city, setCity] = useState(location.city);
  const [district, setDistrict] = useState(location.district);
  const [region, setRegion] = useState(location.region);
  const [postalCode, setPostalCode] = useState(location.postalCode);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<GeoapifyFeature[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim() ?? '';
  useEffect(() => setCurrencyDraft(currencyCode), [currencyCode]);
  useEffect(() => setCountryDraft(countryCode(location.country)), [location.country]);
  useEffect(() => {
    setAddressLine1(location.addressLine1); setCity(location.city); setDistrict(location.district);
    setRegion(location.region); setPostalCode(location.postalCode);
  }, [location.addressLine1, location.city, location.district, location.region, location.postalCode]);
  const fields = countryFields(countryDraft);

  useEffect(() => {
    if (!geoapifyKey || !countryDraft || addressSearch.trim().length < 3) {
      setAddressSuggestions([]); setAddressLoading(false); return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLoading(true); setAddressError('');
      try {
        const query = new URLSearchParams({ text: addressSearch.trim(), filter: `countrycode:${countryDraft.toLowerCase()}`, format: 'geojson', limit: '7', apiKey: geoapifyKey });
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${query}`, { signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { message?: string; reason?: string; error?: string };
          const detail = payload.message || payload.reason || payload.error;
          const hint = response.status === 401 || response.status === 403 ? ' Check the key value and Geoapify allowed origins.' : response.status === 429 ? ' Geoapify request limit reached; try again later.' : '';
          throw new Error(`Geoapify request failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}${hint}`);
        }
        const result = await response.json() as { features?: GeoapifyFeature[] };
        setAddressSuggestions(result.features ?? []);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setAddressError(reason instanceof TypeError ? 'Could not reach Geoapify. Check the allowed origin and CORS settings for this website.' : reason instanceof Error ? reason.message : 'Address search request failed.');
        }
      } finally { if (!controller.signal.aborted) setAddressLoading(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [addressSearch, countryDraft, geoapifyKey]);

  function chooseAddress(feature: GeoapifyFeature) {
    const place = feature.properties;
    const locality = place.city || place.town || place.village || place.municipality || '';
    setAddressLine1([place.housenumber, place.street].filter(Boolean).join(' ') || place.address_line1 || '');
    setCity(locality);
    setDistrict(place.district || place.suburb || place.neighbourhood || place.county || '');
    setRegion(place.state || place.province || place.region || '');
    setPostalCode(place.postcode || '');
    setAddressSearch(place.formatted || '');
    setAddressSuggestions([]);
    setAddressError('');
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
        <label>Business currency<select value={currencyDraft} onChange={event => setCurrencyDraft(event.target.value as CurrencyCode)}>{supportedCurrencies.map(code => <option key={code} value={code}>{code} — {currencyName(code)}</option>)}</select></label>
        <p className="settings-help">Currency applies to business records. It does not convert existing amounts, and is locked after you add prices or financial records.</p>
        <div className="settings-location-fields">
          <label>Country or region<select name="country" value={countryDraft} onChange={event => { setCountryDraft(event.target.value); setAddressSearch(''); setAddressSuggestions([]); setAddressLine1(''); setCity(''); setDistrict(''); setRegion(''); setPostalCode(''); }}><option value="">Select a country or region</option>{countryOptions.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
          <div className="business-address-search"><label htmlFor="business-address-search">Find address, city, district, or postal code</label><input id="business-address-search" value={addressSearch} onChange={event => setAddressSearch(event.target.value)} disabled={!countryDraft || !geoapifyKey} placeholder={!countryDraft ? 'Select a country first' : !geoapifyKey ? 'Address search setup required' : 'Start typing a place or address'} autoComplete="off" aria-autocomplete="list" aria-expanded={addressSuggestions.length > 0}/>{addressLoading && <small>Searching locations…</small>}{addressSuggestions.length > 0 && <div className="address-suggestions" role="listbox" aria-label="Address suggestions">{addressSuggestions.map(feature => <button type="button" role="option" key={feature.properties.place_id} onClick={() => chooseAddress(feature)}><strong>{feature.properties.name || feature.properties.address_line1 || feature.properties.formatted}</strong><span>{feature.properties.formatted}</span></button>)}</div>}{geoapifyKey && !addressLoading && !addressError && addressSearch.trim().length >= 3 && addressSuggestions.length === 0 && <small>No matching places found. You can still fill the address fields below.</small>}{addressError && <small className="address-search-error" role="alert">{addressError}</small>}{!geoapifyKey && <small>Add a Geoapify key to enable country-filtered address suggestions. You can still enter each field manually.</small>}{geoapifyKey && <small>Place searches are sent to Geoapify for suggestions.</small>}</div>
          <label>Business address<input name="addressLine1" maxLength={200} value={addressLine1} onChange={event => setAddressLine1(event.target.value)} placeholder="Street address" autoComplete="street-address"/></label>
          <div className="settings-address-row">
            <label>City or town<input name="city" maxLength={100} value={city} onChange={event => setCity(event.target.value)} autoComplete="address-level2"/></label>
            <label>District / county<input name="district" maxLength={100} value={district} onChange={event => setDistrict(event.target.value)} autoComplete="address-level3"/></label>
          </div>
          <div className="settings-address-row"><label>{fields.regionLabel}<input name="region" maxLength={100} value={region} onChange={event => setRegion(event.target.value)} autoComplete="address-level1"/></label><label>{fields.postalLabel}<input name="postalCode" maxLength={30} value={postalCode} onChange={event => setPostalCode(event.target.value)} autoComplete="postal-code"/></label></div>
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
