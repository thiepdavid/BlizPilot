import 'dotenv/config';
import { app } from './app.js';

function assertProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CORS_ORIGIN'];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Refusing to start in production: missing required security configuration (${missing.join(', ')}).`);
  }

  let supabaseUrl: URL;
  try { supabaseUrl = new URL(process.env.SUPABASE_URL!); }
  catch { throw new Error('Refusing to start in production: SUPABASE_URL must be a valid HTTPS URL.'); }
  if (supabaseUrl.protocol !== 'https:') {
    throw new Error('Refusing to start in production: SUPABASE_URL must use HTTPS.');
  }

  const origins = process.env.CORS_ORIGIN!.split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || parsed.origin !== origin || Boolean(parsed.username || parsed.password);
    }
    catch { return true; }
  })) {
    throw new Error('Refusing to start in production: every CORS_ORIGIN entry must be an HTTPS origin only (for example, https://your-site.example).');
  }

  const clientOrigin = process.env.CLIENT_ORIGIN?.trim();
  if (clientOrigin) {
    try {
      const parsed = new URL(clientOrigin);
      if (parsed.protocol !== 'https:' || parsed.origin !== clientOrigin || !origins.includes(clientOrigin)) throw new Error();
    } catch {
      throw new Error('Refusing to start in production: CLIENT_ORIGIN must be one of the HTTPS origins listed in CORS_ORIGIN.');
    }
  }
}

assertProductionSecurityConfig();

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`BlizPilot API listening on port ${port}`);
});
