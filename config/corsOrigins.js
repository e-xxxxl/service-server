// config/corsOrigins.js
//
// A single exact-string match against CLIENT_URL used to be the whole CORS
// policy (both here and in socket.js). That's fragile: if a user hits
// www.9jatradiespages.com while CLIENT_URL is set to the bare apex domain
// (or vice versa), every request from that origin gets silently blocked by
// the browser - which surfaces to users as an opaque "Failed to fetch"
// with no server-side error to even log. This derives both the www and
// non-www variant of whatever CLIENT_URL is configured, plus local dev
// origins, so that mismatch can't happen.
function deriveOriginVariants(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const bareHost = parsed.hostname.replace(/^www\./, '');
    return [
      `${parsed.protocol}//${bareHost}`,
      `${parsed.protocol}//www.${bareHost}`
    ];
  } catch {
    return [url];
  }
}

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const allowedOrigins = [
  ...new Set([
    ...deriveOriginVariants(process.env.CLIENT_URL),
    ...LOCAL_DEV_ORIGINS
  ])
];

// Requests with no Origin header (server-to-server calls, curl, native
// apps, the Paystack webhook, Postman) are never subject to browser CORS
// enforcement in the first place, so there's nothing to check them
// against - let them through rather than rejecting on a header they were
// never going to send.
function isOriginAllowed(origin) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

module.exports = { allowedOrigins, isOriginAllowed };
