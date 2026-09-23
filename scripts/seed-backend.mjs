#!/usr/bin/env node
// Seeds demo accounts + sample listings/demands through the AgriFlow API.
// Idempotent: re-running just logs in to existing accounts instead of failing.
//
// Usage:
//   node scripts/seed-backend.mjs                       # seeds http://localhost:8080/api
//   API_URL=https://agriflow-api-production.up.railway.app/api node scripts/seed-backend.mjs
//
// Creating the admin account needs ADMIN_REGISTRATION_KEY set to the same
// value the API runs with (see backend/.env.example).

const API_URL = process.env.API_URL ?? 'http://localhost:8080/api';
const ADMIN_KEY = process.env.ADMIN_REGISTRATION_KEY;
const PASSWORD = 'agriflow123';

const USERS = [
  { name: 'Kola Farms Ltd', email: 'buyer@kolafarms.com', role: 'buyer', organizationName: 'Kola Farms Ltd', phone: '+234 802 345 6789', location: 'Ikeja, Lagos' },
  { name: 'Adeyemi Produce Co.', email: 'supplier@adeyemi.com', role: 'supplier', organizationName: 'Adeyemi Produce Co.', phone: '+234 801 234 5678', location: 'Ogbomoso, Oyo State' },
  { name: 'SwiftHaul Logistics', email: 'logistics@swifthaul.com', role: 'logistics', organizationName: 'SwiftHaul Logistics', phone: '+234 803 456 7890', location: 'Lagos / Oyo / Kwara Corridor' },
  { name: 'AgriFlow Operations', email: 'admin@agriflow.ng', role: 'admin', organizationName: 'AgriFlow', phone: '+234 800 000 0000', location: 'Lagos, Nigeria' },
];

const LISTINGS = [
  { commodity: 'maize', quantity: 18, unit: 'tonnes', qualityGrade: 'A', pricePerUnit: 480000, currency: 'NGN', location: 'Ogbomoso, Oyo State', availabilityDate: daysFromNow(5), description: 'Grade A White Maize. Clean, dried to standard 12% moisture content.' },
  { commodity: 'soybean', quantity: 12, unit: 'tonnes', qualityGrade: 'A', pricePerUnit: 465000, currency: 'NGN', location: 'Ogbomoso, Oyo State', availabilityDate: daysFromNow(6), description: 'High-protein Non-GMO Soybeans, Grade A certified.' },
];

const DEMANDS = [
  { commodity: 'maize', quantity: 12, unit: 'tonnes', qualityGrade: 'A', destinationLocation: 'Ikeja, Lagos', requiredByDate: daysFromNow(14), indicativeBudget: 6000000, currency: 'NGN', notes: 'White Maize Grade A. Required for food processing plant in Ikeja.' },
];

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

async function registerOrLogin(user) {
  // Admins can only be registered with the server's ADMIN_REGISTRATION_KEY.
  const headers = user.role === 'admin' && ADMIN_KEY ? { 'X-Admin-Registration-Key': ADMIN_KEY } : {};
  try {
    const resp = await api('/auth/register', { method: 'POST', headers, body: JSON.stringify({ ...user, password: PASSWORD }) });
    console.log(`  created ${user.role.padEnd(10)} ${user.email}`);
    return resp;
  } catch (err) {
    if (!String(err.message).includes('already exists')) throw err;
    const resp = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: PASSWORD }) });
    console.log(`  exists  ${user.role.padEnd(10)} ${user.email}`);
    return resp;
  }
}

async function main() {
  console.log(`Seeding ${API_URL}\n`);

  console.log('Accounts:');
  const sessions = {};
  for (const user of USERS) {
    sessions[user.role] = await registerOrLogin(user);
  }

  console.log('\nListings (as supplier):');
  for (const listing of LISTINGS) {
    const created = await api('/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessions.supplier.token}` },
      body: JSON.stringify(listing),
    });
    console.log(`  ${created.id}  ${created.quantity}${created.unit} ${created.commodity} @ ${created.pricePerUnit}/${created.unit}`);
  }

  console.log('\nDemands (as buyer):');
  for (const demand of DEMANDS) {
    const created = await api('/demands', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessions.buyer.token}` },
      body: JSON.stringify(demand),
    });
    console.log(`  ${created.id}  ${created.quantity}${created.unit} ${created.commodity} -> ${created.destinationLocation}`);
  }

  console.log('\nDone. Demo accounts (password: agriflow123):');
  for (const user of USERS) console.log(`  ${user.role.padEnd(10)} ${user.email}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
