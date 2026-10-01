// ISO 3166-1 alpha-2 codes. Intl.DisplayNames supplies translated names in the user's language.
const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ');

const names = new Intl.DisplayNames(undefined, { type: 'region' });
export const countryOptions = countryCodes
  .map(code => ({ code, name: names.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countryNamesEnglish = new Intl.DisplayNames('en', { type: 'region' });
const countryAliases: Record<string, string> = {
  'uk': 'GB', 'united kingdom': 'GB', 'usa': 'US', 'united states of america': 'US',
  'south korea': 'KR', 'north korea': 'KP', 'uae': 'AE', 'russia': 'RU',
  'vietnam': 'VN', 'iran': 'IR', 'syria': 'SY', 'czech republic': 'CZ',
  'ivory coast': 'CI', 'bolivia': 'BO', 'tanzania': 'TZ', 'moldova': 'MD',
};
export function countryCode(value: string): string {
  const normalized = value.trim();
  if (/^[A-Za-z]{2}$/.test(normalized) && countryCodes.includes(normalized.toUpperCase())) return normalized.toUpperCase();
  if (countryAliases[normalized.toLowerCase()]) return countryAliases[normalized.toLowerCase()];
  return countryCodes.find(code => countryNamesEnglish.of(code)?.toLowerCase() === normalized.toLowerCase()) ?? '';
}

export function countryName(value: string): string {
  const code = countryCode(value);
  return code ? names.of(code) ?? value : value;
}

type CountryFields = { regionLabel: string; postalLabel: string; taxLabel: string; taxHint: string };
const defaults: CountryFields = { regionLabel: 'State, province, or region', postalLabel: 'Postal code', taxLabel: 'Tax registration number', taxHint: 'Enter it only if your business has one.' };
const localizedFields: Record<string, Partial<CountryFields>> = {
  US: { regionLabel: 'State', postalLabel: 'ZIP code', taxLabel: 'EIN or other tax ID', taxHint: 'For example, an EIN if your business has one.' },
  CA: { regionLabel: 'Province or territory', postalLabel: 'Postal code', taxLabel: 'Business Number (BN)', taxHint: 'For example, a BN or GST/HST account number if registered.' },
  GB: { regionLabel: 'County or region', postalLabel: 'Postcode', taxLabel: 'VAT registration number', taxHint: 'Enter a VAT number only if your business is VAT-registered.' },
  IN: { regionLabel: 'State or union territory', postalLabel: 'PIN code', taxLabel: 'GSTIN or other tax ID', taxHint: 'Enter a GSTIN only if your business is registered for GST.' },
  AU: { regionLabel: 'State or territory', postalLabel: 'Postcode', taxLabel: 'Australian Business Number (ABN)', taxHint: 'Enter an ABN only if your business has one.' },
  NZ: { regionLabel: 'Region', postalLabel: 'Postcode', taxLabel: 'GST number', taxHint: 'Enter a GST number only if your business is GST-registered.' },
  SG: { regionLabel: 'Region', postalLabel: 'Postal code', taxLabel: 'UEN or GST registration number', taxHint: 'Enter the identifier that applies to your business, if registered.' },
  AE: { regionLabel: 'Emirate', postalLabel: 'Postal code (if applicable)', taxLabel: 'Tax Registration Number (TRN)', taxHint: 'Enter a TRN only if your business is VAT-registered.' },
  ZA: { regionLabel: 'Province', postalLabel: 'Postal code', taxLabel: 'Tax reference number or VAT number', taxHint: 'Enter the identifier applicable to your business, if registered.' },
  DE: { regionLabel: 'State (Land)', postalLabel: 'Postcode', taxLabel: 'VAT ID or tax number', taxHint: 'Enter a VAT ID or tax number if one applies to your business.' },
  FR: { regionLabel: 'Region', postalLabel: 'Postal code', taxLabel: 'VAT number (N° de TVA)', taxHint: 'Enter a VAT number only if your business is VAT-registered.' },
  JP: { regionLabel: 'Prefecture', postalLabel: 'Postal code', taxLabel: 'Corporate Number or tax ID', taxHint: 'Enter the business identifier applicable to your organization, if any.' },
  BR: { regionLabel: 'State', postalLabel: 'Postal code (CEP)', taxLabel: 'CNPJ or CPF', taxHint: 'Use the business or individual tax identifier applicable to your registration.' },
  MX: { regionLabel: 'State', postalLabel: 'Postal code', taxLabel: 'RFC', taxHint: 'Enter an RFC only if your business has one.' },
  KR: { regionLabel: 'Province or metropolitan city', postalLabel: 'Postal code', taxLabel: 'Business registration number', taxHint: 'Enter the number applicable to your business, if registered.' },
  CH: { regionLabel: 'Canton', postalLabel: 'Postcode', taxLabel: 'UID / VAT number', taxHint: 'Enter a UID or VAT number if one applies to your business.' },
  IE: { regionLabel: 'County', postalLabel: 'Eircode', taxLabel: 'VAT number', taxHint: 'Enter a VAT number only if your business is VAT-registered.' },
  NL: { regionLabel: 'Province', postalLabel: 'Postcode', taxLabel: 'VAT ID (btw-id)', taxHint: 'Enter a VAT ID only if your business is VAT-registered.' },
  IT: { regionLabel: 'Province', postalLabel: 'Postcode (CAP)', taxLabel: 'VAT number (Partita IVA)', taxHint: 'Enter a VAT number only if your business is VAT-registered.' },
  ES: { regionLabel: 'Province or autonomous community', postalLabel: 'Postal code', taxLabel: 'NIF / VAT ID', taxHint: 'Enter the identifier applicable to your business, if registered.' },
  AR: { regionLabel: 'Province', postalLabel: 'Postal code', taxLabel: 'CUIT / CUIL', taxHint: 'Enter the identifier applicable to your business, if registered.' },
};

export function countryFields(value: string): CountryFields {
  return { ...defaults, ...(localizedFields[countryCode(value)] ?? {}) };
}
