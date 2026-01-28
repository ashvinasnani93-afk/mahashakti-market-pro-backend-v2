// ==========================================
// ANGEL LIVE DATA ENGINE (PRODUCTION)
// MAHASHAKTI MARKET PRO
// ==========================================

const { connectAngelSocket, subscribeTokens } = require("./services/angel/angelSocket");
const { fetchOptionTokens } = require("./services/angel/angelTokens");

let wsConnected = false;
let systemReady = false;

// LIVE LTP STORE
const latestLtpStore = {};

/**
 * Internal update hook
 */
function updateLtp(symbol, ltp) {
  latestLtpStore[symbol] = {
    ltp,
    time: Date.now()
  };
}

/**
 * Get latest LTP (used by APIs)
 */
function getLtp(symbol) {
  return latestLtpStore[symbol] || null;
}

/**
 * MAIN ENGINE BOOT
 */
async function startAngelEngine() {
  console.log("🚀 Angel LIVE Engine Booting...");

  try {
    const tokens = await fetchOptionTokens();

    connectAngelSocket((tick) => {
      if (!tick || !tick.token) return;

      updateLtp(tick.token, tick.ltp);
    });

    subscribeTokens(tokens);

    wsConnected = true;
    systemReady = true;

    console.log("🟢 LIVE WebSocket CONNECTED");
    console.log("🧠 SYSTEM STATE: READY");
  } catch (err) {
    console.error("❌ Angel Engine Boot Failed:", err.message);
    wsConnected = false;
    systemReady = false;
  }
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
  startAngelEngine,
  getLtp,
  isSystemReady,
  isWsConnected
};
