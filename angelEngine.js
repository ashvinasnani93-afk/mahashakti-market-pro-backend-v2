// ===============================
// ANGEL REAL DATA ENGINE (BASE)
// MAHASHAKTI MARKET PRO
// ===============================

let latestLtpStore = {};

/**
 * Update LTP from real feed (future use: WebSocket)
 */
function updateLtp(symbol, ltp) {
  latestLtpStore[symbol] = {
    ltp,
    time: Date.now()
  };
}

/**
 * Get latest LTP (used by API)
 */
function getLtp(symbol) {
  return latestLtpStore[symbol] || null;
}

/**
 * TEMP: Demo real-like update (every 2 sec)
 * This will be REPLACED by Angel WebSocket
 */
function startMockFeed() {
  setInterval(() => {
    updateLtp("NIFTY", 25900 + Math.floor(Math.random() * 100));
    updateLtp("BANKNIFTY", 56000 + Math.floor(Math.random() * 200));
  }, 2000);
}

module.exports = {
  startMockFeed,
  getLtp,
};
