// ==========================================
// ANGEL LIVE DATA ENGINE (PRODUCTION)
// MAHASHAKTI MARKET PRO
// PRO WS ENGINE — HEARTBEAT + RECONNECT + DUPLICATE LOCK
// ==========================================

const WebSocket = require("ws");
const { fetchOptionTokens } = require("./services/angel/angelTokens");
const { getAllSymbols } = require("./symbol.service");

// ================================
// ENGINE STATE
// ================================
let ws = null;
let wsConnected = false;
let systemReady = false;
let engineRunning = false;
let heartbeatTimer = null;
let reconnectLock = false;

// ================================
// LIVE LTP STORE
// ================================
const latestLtpStore = {};

// ===================================
// OPTION SYMBOL MASTER LINK
// ===================================
let OPTION_SYMBOLS = {};

function setSymbolMaster(map) {
  if (!map || typeof map !== "object") {
    console.log("⚠️ setSymbolMaster called with invalid map");
    return;
  }

  OPTION_SYMBOLS = map;
  console.log("📌 Angel Engine linked option symbols:", Object.keys(map).length);
}

/**
 * Internal update hook
 */
function updateLtp(symbol, ltp) {
  latestLtpStore[symbol] = {
    ltp,
    time: Date.now(),
  };
}

/**
 * Get latest LTP (used by APIs)
 */
function getLtp(symbol) {
  return latestLtpStore[symbol] || null;
}

// ================================
// HEARTBEAT SYSTEM
// ================================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && wsConnected) {
      try {
        ws.send(JSON.stringify({ action: "ping" }));
        console.log("❤️ WS Heartbeat");
      } catch (e) {
        console.log("⚠️ WS Heartbeat failed");
      }
    }
  }, 25000); // Angel safe zone
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ================================
// WEBSOCKET STARTER
// ================================
function startWebSocket(feedToken, clientCode, tokens) {
  if (wsConnected || reconnectLock) {
    console.log("⚠️ WS already active — skipping start");
    return;
  }

  reconnectLock = true;
  console.log("🔌 Starting Angel WebSocket...");

  const url = "wss://smartapisocket.angelone.in/smart-stream";

  ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${feedToken}`,
      "x-client-code": clientCode,
      "x-feed-token": feedToken,
    },
  });

  ws.on("open", () => {
    wsConnected = true;
    reconnectLock = false;

    console.log("🟢 WebSocket Connected");

    startHeartbeat();
    subscribeTokens(tokens);
  });

  ws.on("message", (data) => {
    try {
      const tick = JSON.parse(data.toString());

      if (tick && tick.token && tick.ltp) {
        updateLtp(tick.token, tick.ltp);
      }
    } catch (err) {
      console.log("⚠️ WS Parse Error");
    }
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket Disconnected");

    wsConnected = false;
    systemReady = false;
    engineRunning = false;

    stopHeartbeat();

    setTimeout(() => {
      console.log("🔁 Reconnecting Angel Engine...");
    }, 5000);
  });

  ws.on("error", (err) => {
    console.log("❌ WS ERROR:", err.message);
    try {
      ws.close();
    } catch (e) {}
  });
}

// ================================
// TOKEN SUBSCRIBE
// ================================
function subscribeTokens(tokens) {
  if (!ws || !wsConnected || !Array.isArray(tokens)) return;

  const payload = {
    action: "subscribe",
    mode: "LTP",
    tokens,
  };

  try {
    ws.send(JSON.stringify(payload));
    console.log(`📡 Subscribed Tokens: ${tokens.length}`);
  } catch (err) {
    console.log("⚠️ Token subscribe failed");
  }
}

// ================================
// MAIN ENGINE BOOT
// ================================
async function startAngelEngine() {
  if (engineRunning) {
    console.log("⚠️ Angel Engine already running");
    return;
  }

  engineRunning = true;
  console.log("🚀 Angel LIVE Engine Booting...");

  const symbols = getAllSymbols();

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    console.log("⏳ Angel Engine waiting: Symbol Master not ready yet");
    engineRunning = false;
    return;
  }

  try {
    const tokenData = await fetchOptionTokens();

    if (
      !tokenData ||
      !tokenData.feedToken ||
      !tokenData.clientCode ||
      !Array.isArray(tokenData.tokens)
    ) {
      throw new Error("Invalid Angel token bundle");
    }

    systemReady = true;
    console.log("🧠 SYSTEM STATE: READY");

    startWebSocket(
      tokenData.feedToken,
      tokenData.clientCode,
      tokenData.tokens
    );
  } catch (err) {
    console.error("❌ Angel Engine Boot Failed:", err.message);
    wsConnected = false;
    systemReady = false;
    engineRunning = false;
  }
}

// ================================
// SYSTEM STATUS GETTERS
// ================================
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
  isWsConnected,
  setSymbolMaster   // 🔥 REQUIRED FOR OPTION MASTER LINK
};
