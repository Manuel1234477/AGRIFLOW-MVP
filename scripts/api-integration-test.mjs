#!/usr/bin/env node
// Integration test script for the AgriFlow API — exercises every endpoint
// the frontend uses, plus the error paths (wrong password, wrong role,
// invalid transition, over-stock purchase). Uses fresh, uniquely-suffixed
// accounts each run so it's safe to re-run against a persistent database.
//
// Usage:
//   node scripts/api-integration-test.mjs                       # http://localhost:8080/api
//   API_URL=https://...  node scripts/api-integration-test.mjs  # against another target

const API_URL = process.env.API_URL ?? 'http://localhost:8080/api';
const RUN_ID = Date.now().toString(36);

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function req(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  console.log(`Testing ${API_URL}\n`);

  // --- Register one user per role ---
  console.log('auth:');
  const buyer = await req('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test Buyer', email: `buyer-${RUN_ID}@test.agriflow`, password: 'testpass123', role: 'buyer' }) });
  check('register buyer -> 200', buyer.status === 200, `got ${buyer.status}`);
  check('register buyer -> returns token + user', !!buyer.body?.token && buyer.body?.user?.role === 'buyer');

  const supplier = await req('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test Supplier', email: `supplier-${RUN_ID}@test.agriflow`, password: 'testpass123', role: 'supplier' }) });
  check('register supplier -> 200', supplier.status === 200, `got ${supplier.status}`);

  const adminBody = JSON.stringify({ name: 'Test Admin', email: `admin-${RUN_ID}@test.agriflow`, password: 'testpass123', role: 'admin' });
  const selfAdmin = await req('/auth/register', { method: 'POST', body: adminBody });
  check('register admin without key -> 403', selfAdmin.status === 403, `got ${selfAdmin.status}`);
  const wrongKeyAdmin = await req('/auth/register', { method: 'POST', headers: { 'X-Admin-Registration-Key': 'wrong-key' }, body: adminBody });
  check('register admin with wrong key -> 403', wrongKeyAdmin.status === 403, `got ${wrongKeyAdmin.status}`);

  // The rest of the run needs an admin, so the API's key must be provided.
  const adminKey = process.env.ADMIN_REGISTRATION_KEY;
  if (!adminKey) throw new Error('set ADMIN_REGISTRATION_KEY to the API\'s value to run the admin checks');
  const admin = await req('/auth/register', { method: 'POST', headers: { 'X-Admin-Registration-Key': adminKey }, body: adminBody });
  check('register admin with key -> 200', admin.status === 200 && admin.body?.user?.role === 'admin', `got ${admin.status}`);

  const dupe = await req('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Dupe', email: buyer.body.user.email, password: 'testpass123', role: 'buyer' }) });
  check('register duplicate email -> 409', dupe.status === 409, `got ${dupe.status}`);

  const wrongPw = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: buyer.body.user.email, password: 'wrong-password' }) });
  check('login wrong password -> 401', wrongPw.status === 401, `got ${wrongPw.status}`);

  const login = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: buyer.body.user.email, password: 'testpass123' }) });
  check('login correct password -> 200', login.status === 200, `got ${login.status}`);

  const me = await req('/auth/me', { headers: authHeader(buyer.body.token) });
  check('GET /auth/me -> matches registered buyer', me.status === 200 && me.body.email === buyer.body.user.email);

  const noAuth = await req('/auth/me');
  check('GET /auth/me without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);

  const buyerToken = buyer.body.token;
  const supplierToken = supplier.body.token;
  const adminToken = admin.body.token;

  // --- Listings ---
  console.log('\nlistings:');
  const listingAsBuyer = await req('/listings', { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ commodity: 'maize', quantity: 10, unit: 'tonnes', qualityGrade: 'A', pricePerUnit: 480000, location: 'Test', availabilityDate: new Date().toISOString(), description: 'x' }) });
  check('buyer POST /listings -> 403', listingAsBuyer.status === 403, `got ${listingAsBuyer.status}`);

  const listing = await req('/listings', { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ commodity: 'maize', quantity: 10, unit: 'tonnes', qualityGrade: 'A', pricePerUnit: 480000, currency: 'NGN', location: 'Test Location', availabilityDate: new Date().toISOString(), description: 'Integration test listing' }) });
  check('supplier POST /listings -> 200', listing.status === 200, `got ${listing.status}`);
  check('listing.quantity is a numeric string (decimal-as-string)', typeof listing.body?.quantity === 'string' && !Number.isNaN(Number(listing.body.quantity)));

  const listingsMineAsBuyer = await req('/listings/mine', { headers: authHeader(buyerToken) });
  check('buyer GET /listings/mine -> 403', listingsMineAsBuyer.status === 403, `got ${listingsMineAsBuyer.status}`);

  const listingsMine = await req('/listings/mine', { headers: authHeader(supplierToken) });
  check('supplier GET /listings/mine -> includes created listing', listingsMine.status === 200 && listingsMine.body.some((l) => l.id === listing.body.id));

  const listingsActive = await req('/listings');
  check('GET /listings (public) -> includes active listing', listingsActive.status === 200 && listingsActive.body.some((l) => l.id === listing.body.id));

  const listingOne = await req(`/listings/${listing.body.id}`);
  check('GET /listings/:id -> 200', listingOne.status === 200 && listingOne.body.id === listing.body.id);

  // --- Demands ---
  console.log('\ndemands:');
  const demandAsSupplier = await req('/demands', { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ commodity: 'maize', quantity: 5, unit: 'tonnes', qualityGrade: 'A', destinationLocation: 'X', requiredByDate: new Date().toISOString(), indicativeBudget: 100 }) });
  check('supplier POST /demands -> 403', demandAsSupplier.status === 403, `got ${demandAsSupplier.status}`);

  const demand = await req('/demands', { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ commodity: 'maize', quantity: 5, unit: 'tonnes', qualityGrade: 'A', destinationLocation: 'Ikeja, Lagos', requiredByDate: new Date(Date.now() + 864e6).toISOString(), indicativeBudget: 2500000, currency: 'NGN' }) });
  check('buyer POST /demands -> 200', demand.status === 200, `got ${demand.status}`);

  const demandsMine = await req('/demands/mine', { headers: authHeader(buyerToken) });
  check('buyer GET /demands/mine -> includes created demand', demandsMine.status === 200 && demandsMine.body.some((d) => d.id === demand.body.id));

  // --- Transactions ---
  console.log('\ntransactions:');
  const overStock = await req('/transactions', { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ listingId: listing.body.id, quantity: 999999, deliveryLocation: 'Ikeja, Lagos', expectedDeliveryDate: new Date(Date.now() + 864e6).toISOString() }) });
  check('transaction over available stock -> 400', overStock.status === 400, `got ${overStock.status}`);

  const txn = await req('/transactions', { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ listingId: listing.body.id, quantity: 5, deliveryLocation: 'Ikeja, Lagos', expectedDeliveryDate: new Date(Date.now() + 864e6).toISOString() }) });
  check('valid transaction -> 200', txn.status === 200, `got ${txn.status}`);
  check('transaction response includes history[]', Array.isArray(txn.body?.history) && txn.body.history.length === 1);
  check('transaction.totalAmount is numeric string', typeof txn.body?.totalAmount === 'string');

  const selfTxn = await req('/transactions', { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ listingId: listing.body.id, quantity: 1, deliveryLocation: 'X', expectedDeliveryDate: new Date(Date.now() + 864e6).toISOString() }) });
  check('supplier buying own listing -> rejected (400/403)', selfTxn.status === 400 || selfTxn.status === 403, `got ${selfTxn.status}`);

  const listMineBuyer = await req('/transactions', { headers: authHeader(buyerToken) });
  check('buyer GET /transactions -> role-scoped, includes own txn', listMineBuyer.status === 200 && listMineBuyer.body.some((t) => t.id === txn.body.id));
  check('list endpoint omits history field', listMineBuyer.body.find((t) => t.id === txn.body.id)?.history === undefined);

  const listMineSupplier = await req('/transactions', { headers: authHeader(supplierToken) });
  check('supplier GET /transactions -> sees the same txn (participant)', listMineSupplier.status === 200 && listMineSupplier.body.some((t) => t.id === txn.body.id));

  const listAdmin = await req('/transactions', { headers: authHeader(adminToken) });
  check('admin GET /transactions -> sees all (includes txn)', listAdmin.status === 200 && listAdmin.body.some((t) => t.id === txn.body.id));

  const invalidTransition = await req(`/transactions/${txn.body.id}/transition`, { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ to: 'ACCEPTED' }) });
  check('buyer self-accepting transaction -> rejected', invalidTransition.status === 409 || invalidTransition.status === 403, `got ${invalidTransition.status}`);

  const accept = await req(`/transactions/${txn.body.id}/transition`, { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ to: 'ACCEPTED', note: 'Accepted in integration test.' }) });
  check('supplier accepts transaction -> 200', accept.status === 200 && accept.body.status === 'ACCEPTED', `got ${accept.status}`);
  check('accept response history has 2 events', accept.body?.history?.length === 2);

  const getOne = await req(`/transactions/${txn.body.id}`, { headers: authHeader(buyerToken) });
  check('GET /transactions/:id -> reflects ACCEPTED status', getOne.status === 200 && getOne.body.status === 'ACCEPTED');

  const outsiderTxn = await req(`/transactions/${txn.body.id}`, { headers: authHeader(adminToken) });
  check('admin (non-participant) can still GET the transaction', outsiderTxn.status === 200);

  const badStatus = await req(`/transactions/${txn.body.id}/transition`, { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ to: 'NOT_A_REAL_STATUS' }) });
  check('transition to unknown status -> 400', badStatus.status === 400, `got ${badStatus.status}`);

  // --- Mock escrow payment (PAYMENT_CONFIRMED/LOGISTICS_PENDING require a
  // system actor no real JWT can present — these are the one legitimate,
  // buyer-scoped path there; see backend/src/routes/transactions.rs) ---
  console.log('\nmock payment:');
  const toPay = await req(`/transactions/${txn.body.id}/transition`, { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ to: 'PAYMENT_PENDING' }) });
  check('buyer -> PAYMENT_PENDING -> 200', toPay.status === 200, `got ${toPay.status}`);

  const wrongPayer = await req(`/transactions/${txn.body.id}/payment/confirm`, { method: 'POST', headers: authHeader(supplierToken) });
  check('supplier confirming payment -> 403 (not the buyer)', wrongPayer.status === 403, `got ${wrongPayer.status}`);

  const noAuthConfirm = await req(`/transactions/${txn.body.id}/payment/confirm`, { method: 'POST' });
  check('confirm payment without auth -> 401', noAuthConfirm.status === 401, `got ${noAuthConfirm.status}`);

  const confirmed = await req(`/transactions/${txn.body.id}/payment/confirm`, { method: 'POST', headers: authHeader(buyerToken) });
  check('buyer confirms payment -> 200, jumps to LOGISTICS_PENDING', confirmed.status === 200 && confirmed.body.status === 'LOGISTICS_PENDING', `got ${confirmed.status} ${confirmed.body?.status}`);
  check('confirm payment history includes PAYMENT_CONFIRMED then LOGISTICS_PENDING', confirmed.body.history.slice(-2).map((e) => e.status).join(',') === 'PAYMENT_CONFIRMED,LOGISTICS_PENDING');

  const reconfirm = await req(`/transactions/${txn.body.id}/payment/confirm`, { method: 'POST', headers: authHeader(buyerToken) });
  check('confirming an already-settled payment -> 409', reconfirm.status === 409, `got ${reconfirm.status}`);

  // Separate transaction for the payment-failure path.
  const txn2 = await req('/transactions', { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ listingId: listing.body.id, quantity: 1, deliveryLocation: 'Ikeja, Lagos', expectedDeliveryDate: new Date(Date.now() + 864e6).toISOString() }) });
  await req(`/transactions/${txn2.body.id}/transition`, { method: 'POST', headers: authHeader(supplierToken), body: JSON.stringify({ to: 'ACCEPTED' }) });
  await req(`/transactions/${txn2.body.id}/transition`, { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ to: 'PAYMENT_PENDING' }) });
  const failed = await req(`/transactions/${txn2.body.id}/payment/fail`, { method: 'POST', headers: authHeader(buyerToken), body: JSON.stringify({ reason: 'Insufficient funds (integration test).' }) });
  check('buyer fails payment -> 200, PAYMENT_FAILED', failed.status === 200 && failed.body.status === 'PAYMENT_FAILED', `got ${failed.status} ${failed.body?.status}`);

  // --- Summary ---
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFailed checks:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nTest script crashed:', err);
  process.exit(1);
});
