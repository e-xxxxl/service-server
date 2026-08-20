// TEMPORARY - consolidated withdrawal system E2E test. Not committed.
require('dotenv').config();
const mongoose = require('mongoose');
const ServiceProvider = require('../models/ServiceProvider');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const Conversation = require('../models/Conversation');

const API = 'http://localhost:5000/api';

const seed = {
  customerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhODVjZGMzOGZiMjgwYTZjOTExYWJiNiIsInVzZXJJZCI6IjZhODVjZGMzOGZiMjgwYTZjOTExYWJiNiIsImVtYWlsIjoid2R0ZXN0LmN1c3RvbWVyQGV4YW1wbGUuY29tIiwiYWNjb3VudFR5cGUiOiJjdXN0b21lciIsImlhdCI6MTc4NzE1Mzg4MSwiZXhwIjoxNzg3NzU4NjgxfQ.F90GBJqLb6rVfY3BW7tZYvlNThEDHQ4jlf7nNk9XM8c',
  providerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhODVjZGNhOGZiMjgwYTZjOTExYWJiNyIsInVzZXJJZCI6IjZhODVjZGNhOGZiMjgwYTZjOTExYWJiNyIsImVtYWlsIjoid2R0ZXN0LnByb3ZpZGVyQGV4YW1wbGUuY29tIiwiYWNjb3VudFR5cGUiOiJwcm92aWRlciIsImlhdCI6MTc4NzE1Mzg4MSwiZXhwIjoxNzg3NzU4NjgxfQ.3hwFs0sefetYyCvcIdaP4e5YZesiOg-m0aYbENLhrj0',
  adminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhODVjZGQxOGZiMjgwYTZjOTExYWJiOSIsInVzZXJJZCI6IjZhODVjZGQxOGZiMjgwYTZjOTExYWJiOSIsImVtYWlsIjoid2R0ZXN0LmFkbWluQGV4YW1wbGUuY29tIiwiYWNjb3VudFR5cGUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4NzE1Mzg4MSwiZXhwIjoxNzg3NzU4NjgxfQ.kROo4NC0bDDBoK2vGaC3SeRehT2dhm83UKaRh-APChQ',
  providerId: '6a85cdd18fb280a6c911abb8',
  conversationId: '6a85cdd88fb280a6c911abba',
  reference: 'WDTEST-1787153881109',
  webhookBody: '{"event":"charge.success","data":{"reference":"WDTEST-1787153881109","amount":1500000,"channel":"card","gateway_response":"Successful"}}',
  signature: 'd686051c5e9ca875fb97a4320b76ca53d48ec181efc54d7491426fb330a87cade59de47059c4928e39602d049c1444fb66a1d520cf50692f658135bb6938197e'
};

const results = [];
const log = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + JSON.stringify(detail) : ''}`);
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Fire the signed webhook to trigger fulfillPayment (real code path).
  const webhookRes = await fetch(`${API}/payment/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': seed.signature },
    body: seed.webhookBody
  });
  log('webhook accepted', webhookRes.status === 200, { status: webhookRes.status });

  await new Promise(r => setTimeout(r, 1500)); // let fulfillPayment finish

  const providerAfterPayment = await ServiceProvider.findById(seed.providerId);
  const txAfterPayment = await Transaction.findOne({ reference: seed.reference });

  // Expected: materials 5000 + workmanship*0.6 (6000) = 11000 available; 4000 held.
  log('escrow split: available balance', providerAfterPayment.wallet.balance === 11000, { actual: providerAfterPayment.wallet.balance });
  log('escrow split: held (pendingEarnings)', providerAfterPayment.wallet.pendingEarnings === 4000, { actual: providerAfterPayment.wallet.pendingEarnings });
  log('escrow split: transaction.workmanshipHeld', txAfterPayment.workmanshipHeld === 4000, { actual: txAfterPayment.workmanshipHeld });

  // 2. Provider: list banks (real Paystack test-mode call)
  const banksRes = await fetch(`${API}/provider/banks`, { headers: { Authorization: `Bearer ${seed.providerToken}` } });
  const banksData = await banksRes.json();
  const accessBank = (banksData.data || []).find(b => /access bank/i.test(b.name));
  log('list banks', banksRes.ok && banksData.success && banksData.data.length > 0, { count: banksData.data?.length, foundAccessBank: !!accessBank });

  // 3. Provider: save + verify bank details (real Paystack test-mode resolve)
  // Paystack's documented test account-resolve pair: Access Bank (044) + 0690000031 -> "GOD'S GRACE"-style test name.
  let bankDetailsOk = false;
  let bankDetailsData = null;
  if (accessBank) {
    const bdRes = await fetch(`${API}/provider/bank-details`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${seed.providerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankCode: accessBank.code, accountNumber: '0690000031', whatsappNumber: '08012345678' })
    });
    bankDetailsData = await bdRes.json();
    bankDetailsOk = bdRes.ok && bankDetailsData.success && !!bankDetailsData.data?.accountName;
  }
  log('save + verify bank details', bankDetailsOk, bankDetailsData);

  // 4. Provider requests a withdrawal of 5000 (should reserve out of the 11000 available)
  const wd1Res = await fetch(`${API}/provider/withdrawals`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${seed.providerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 5000 })
  });
  const wd1Data = await wd1Res.json();
  log('request withdrawal (5000)', wd1Res.ok && wd1Data.success, wd1Data);

  const providerAfterRequest = await ServiceProvider.findById(seed.providerId);
  log('balance reserved after request (11000 -> 6000)', providerAfterRequest.wallet.balance === 6000, { actual: providerAfterRequest.wallet.balance });

  // 5. Admin lists withdrawals, sees the pending one
  const listRes = await fetch(`${API}/admin/withdrawals?status=pending`, { headers: { Authorization: `Bearer ${seed.adminToken}` } });
  const listData = await listRes.json();
  const found = (listData.data || []).find(w => w.id === wd1Data.data?.id);
  log('admin sees pending withdrawal', listRes.ok && !!found, { found: !!found, bankSnapshot: found?.bankSnapshot });

  // 6. Admin rejects it -> amount refunded
  const rejectRes = await fetch(`${API}/admin/withdrawals/${wd1Data.data.id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${seed.adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Test rejection - bank details mismatch' })
  });
  const rejectData = await rejectRes.json();
  log('admin rejects withdrawal', rejectRes.ok && rejectData.success, rejectData);

  const providerAfterReject = await ServiceProvider.findById(seed.providerId);
  log('balance refunded after reject (6000 -> 11000)', providerAfterReject.wallet.balance === 11000, { actual: providerAfterReject.wallet.balance });

  // 7. Provider requests another withdrawal of 3000, admin approves with a receipt
  const wd2Res = await fetch(`${API}/provider/withdrawals`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${seed.providerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 3000 })
  });
  const wd2Data = await wd2Res.json();
  log('request withdrawal (3000)', wd2Res.ok && wd2Data.success, wd2Data);

  const fd = new FormData();
  fd.append('receipt', new Blob(['fake receipt content'], { type: 'text/plain' }), 'receipt.txt');
  const approveRes = await fetch(`${API}/admin/withdrawals/${wd2Data.data.id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${seed.adminToken}` },
    body: fd
  });
  const approveData = await approveRes.json();
  log('admin approves withdrawal with receipt', approveRes.ok && approveData.success && !!approveData.data?.receiptUrl, approveData);

  const providerAfterApprove = await ServiceProvider.findById(seed.providerId);
  log('balance stays reduced after approve (11000 -> 8000)', providerAfterApprove.wallet.balance === 8000, { actual: providerAfterApprove.wallet.balance });

  // 8. Withdrawal history reflects both
  const historyRes = await fetch(`${API}/provider/withdrawals`, { headers: { Authorization: `Bearer ${seed.providerToken}` } });
  const historyData = await historyRes.json();
  const statuses = (historyData.data || []).map(w => w.status).sort();
  log('provider withdrawal history has 1 rejected + 1 approved', JSON.stringify(statuses) === JSON.stringify(['approved', 'rejected']), { statuses });

  // 9. Duplicate-apply-style guard: can't withdraw more than available balance
  const overRes = await fetch(`${API}/provider/withdrawals`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${seed.providerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 999999 })
  });
  log('over-balance withdrawal rejected', overRes.status === 400, { status: overRes.status });

  // 10. Job completion release: mark job completed (provider), then customer confirms -> releases held 4000
  await fetch(`${API}/provider/jobs/${seed.conversationId}/start`, { method: 'POST', headers: { Authorization: `Bearer ${seed.providerToken}` } });
  await fetch(`${API}/provider/jobs/${seed.conversationId}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${seed.providerToken}` } });
  const confirmRes = await fetch(`${API}/customer/jobs/${seed.conversationId}/confirm-completion`, { method: 'POST', headers: { Authorization: `Bearer ${seed.customerToken}` } });
  const confirmData = await confirmRes.json();
  log('customer confirms job completion', confirmRes.ok && confirmData.success, confirmData);

  const providerAfterCompletion = await ServiceProvider.findById(seed.providerId);
  log('held workmanship released on completion (8000 -> 12000, pending 4000 -> 0)',
    providerAfterCompletion.wallet.balance === 12000 && providerAfterCompletion.wallet.pendingEarnings === 0,
    { balance: providerAfterCompletion.wallet.balance, pendingEarnings: providerAfterCompletion.wallet.pendingEarnings });

  const txAfterCompletion = await Transaction.findOne({ reference: seed.reference });
  log('transaction workmanshipHeldReleasedAt set', !!txAfterCompletion.workmanshipHeldReleasedAt, { releasedAt: txAfterCompletion.workmanshipHeldReleasedAt });

  // 11. Admin dashboard stats include the new fields
  const dashRes = await fetch(`${API}/admin/dashboard`, { headers: { Authorization: `Bearer ${seed.adminToken}` } });
  const dashData = await dashRes.json();
  const stats = dashData.data?.stats || {};
  log('admin dashboard exposes allTimeRevenue + totalProviderBalanceNet', typeof stats.allTimeRevenue === 'number' && typeof stats.totalProviderBalanceNet === 'number', {
    allTimeRevenue: stats.allTimeRevenue, totalProviderBalanceNet: stats.totalProviderBalanceNet, pendingWithdrawalsCount: stats.pendingWithdrawalsCount
  });

  const failCount = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failCount}/${results.length} passed`);

  await mongoose.disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
