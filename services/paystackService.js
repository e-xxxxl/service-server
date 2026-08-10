// services/paystackService.js
//
// Thin wrapper over Paystack's REST API. Uses the built-in fetch (Node 18+),
// no extra HTTP client dependency needed.
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY environment variable is required but not set');
  }
  return key;
}

async function initializeTransaction({ email, amountNaira, reference, callbackUrl, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100), // Paystack expects kobo
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Failed to initialize payment with Paystack');
  }

  return data.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` }
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Failed to verify payment with Paystack');
  }

  return data.data; // { status: 'success' | 'failed' | ..., amount, reference, channel, gateway_response, ... }
}

module.exports = { initializeTransaction, verifyTransaction, getSecretKey };
