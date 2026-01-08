// ==========================================
// RATE LIMIT UTILITY (SAFE - SIMPLE)
// ==========================================

const requestMap = new Map();

function checkRateLimit(req, limit = 20, windowMs = 60000) {
  const ip =
    req.ip ||
    req.headers["x-forwarded-for"] ||
    "unknown";

  const now = Date.now();

  if (!requestMap.has(ip)) {
    requestMap.set(ip, []);
  }

  const timestamps = requestMap
    .get(ip)
    .filter(ts => now - ts < windowMs);

  timestamps.push(now);
  requestMap.set(ip, timestamps);

  return timestamps.length <= limit;
}

module.exports = {
  checkRateLimit,
};
