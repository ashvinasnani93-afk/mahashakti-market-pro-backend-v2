// ===============================
// ANGEL REAL DATA ENGINE (BASE)
// MAHASHAKTI MARKET PRO
// ===============================

// SYSTEM STATE FLAGS
let wsConnected = false;
let systemReady = false;

// LTP STORE
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
  console.log("📡 MOCK FEED STARTED");

  setInterval(() => {
    updateLtp("NIFTY", 25900 + Math.floor(Math.random() * 100));
    updateLtp("BANKNIFTY", 56000 + Math.floor(Math.random() * 200));
  }, 2000);
}

/**
 * MAIN ENGINE BOOT
 */
function startAngelEngine() {
  console.log("🚀 Angel Engine Booting...");

  startMockFeed();

  wsConnected = true;
  systemReady = true;

  console.log("🟢 MOCK WebSocket CONNECTED");
  console.log("🧠 SYSTEM STATE: READY");
}

/**
 * SYSTEM STATUS GETTERS
 */
function isSystemReady() {
  return systemReady;
}

function isWsConnected() {
  return wsConnected;
}

module.exports = {
  startMockFeed,
  startAngelEngine,
  getLtp,
  isSystemReady,
  isWsConnected
};
