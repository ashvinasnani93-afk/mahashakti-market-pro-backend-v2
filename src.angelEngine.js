// ==========================================
// ANGEL LIVE DATA ENGINE (SINGLE SOURCE)
// MAHASHAKTI MARKET PRO
// PRO WS ENGINE — AUTH + CHUNK + HEARTBEAT + RECONNECT
// ==========================================

const WebSocket = require("ws");
const { fetchOptionTokens } = require("./services/angel/angelTokens");

// ================================
// ENGINE STATE
// ================================
let ws = null;
let wsConnected = false;
let systemReady = false;
let engineRunning = false;
let heartbeatTimer = null;
let reconnectTimer = null;
let OPTION_SYMBOLS = [];

// ================================
// LIVE LTP STORE
// ================================
const latestLtpStore = {};

// ================================
// OPTION MASTER LINK
// ================================
function setSymbolMaster(map) {
  if (!map || typeof map !== "object") {
    console.log("⚠️ setSymbolMaster invalid map");
    return;
  }

  OPTION_SYMBOLS = Array.isArray(map)
    ? map
    : Object.keys(map);

  console.log("🧠 Angel Engine linked OPTION symbols:", OPTION_SYMBOLS.length);
}

// ================================
// LTP UPDATE
// ================================
function updateLtp(symbol, ltp) {
  latestLtpStore[symbol] = {
    ltp,
    time: Date.now()
  };
}

function getLtp(symbol) {
  return latestLtpStore[symbol] || null;
}

// ================================
// HEARTBEAT
// ================================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && wsConnected) {
      try {
        ws.send(JSON.stringify({ action: "ping" }));
        console.log("❤️ WS Heartbeat");
      } catch {
        console.log("⚠️ WS Heartbeat failed");
      }
    }
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// ================================
// TOKEN SUBSCRIBE (CHUNK SAFE)
// ================================
function subscribeTokens(tokens) {
  if (!ws || !wsConnected || !Array.isArray(tokens)) return;

  const CHUNK = 200;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK).map(String);

    const payload = {
      action: "subscribe",
      params: {
        mode: "LTP",
        tokenList: [
          {
            exchangeType: 2,
            tokens: batch
          }
        ]
      }
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch {
      console.log("⚠️ WS chunk send failed");
      return;
    }
  }

  console.log("📡 Subscribed Tokens:", tokens.length);
}

// ================================
// WS CONNECT
// ================================
function connectWS(feedToken, clientCode, tokens) {
  console.log("🔌 Connecting Angel WS...");

  ws = new WebSocket("wss://smartapis.angelone.in/smart-stream");

  ws.on("open", () => {
    wsConnected = true;
    console.log("🟢 WS Connected");

    // AUTH
    ws.send(JSON.stringify({
      action: "authenticate",
      params: {
        feedToken,
        clientCode
      }
    }));

    console.log("🔐 WS AUTH SENT");
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // AUTH CONFIRM
      if (msg?.status === true && msg?.type === "cn") {
        console.log("🔓 WS AUTH SUCCESS");
        systemReady = true;
        startHeartbeat();
        subscribeTokens(tokens);
        return;
      }

      // TICKS
      if (msg?.symbol && msg?.ltp) {
        updateLtp(msg.symbol, msg.ltp);
      }
    } catch {
      // ignore noise
    }
  });

  ws.on("close", () => {
    console.log("🔴 WS Closed — reconnecting...");
    cleanupWS();
    reconnect(feedToken, clientCode, tokens);
  });

  ws.on("error", (err) => {
    console.log("❌ WS Error:", err.message);
    cleanupWS();
    reconnect(feedToken, clientCode, tokens);
  });
}

// ================================
// RECONNECT
// ================================
function cleanupWS() {
  wsConnected = false;
  systemReady = false;
  stopHeartbeat();
  try {
    if (ws) ws.close();
  } catch {}
  ws = null;
}

function reconnect(feedToken, clientCode, tokens) {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWS(feedToken, clientCode, tokens);
  }, 5000);
}

// ================================
// ENGINE BOOT
// ================================
async function startAngelEngine() {
  if (engineRunning) {
    console.log("⚠️ Angel Engine already running");
    return;
  }

  engineRunning = true;
  console.log("🚀 Angel Engine Booting...");

  try {
    const bundle = await fetchOptionTokens();

    if (
      !bundle ||
      !bundle.feedToken ||
      !bundle.clientCode ||
      !Array.isArray(bundle.tokens)
    ) {
      throw new Error("Invalid token bundle");
    }

    console.log("🧠 SYSTEM READY");
    connectWS(
      bundle.feedToken,
      bundle.clientCode,
      bundle.tokens
    );
  } catch (e) {
    engineRunning = false;
    console.log("❌ Engine boot failed:", e.message);
  }
}

// ================================
// STATUS
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
  setSymbolMaster
};
