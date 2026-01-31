// ==========================================
// ANGEL LIVE DATA ENGINE — ENTERPRISE GRADE
// MAHASHAKTI MARKET PRO
// WS 2.0 | BINARY DECODE | CHUNK SUBSCRIBE | HEARTBEAT | RECONNECT
// ==========================================

const WebSocket = require("ws");
const { fetchOptionTokens } = require("./services/angel/angelTokens");
const { getAllSymbols } = require("./symbol.service");

// ==========================================
// ENGINE STATE
// ==========================================
let ws = null;
let wsConnected = false;
let systemReady = false;
let engineRunning = false;
let heartbeatTimer = null;
let reconnectTimer = null;

// TOKEN MASTER FROM server.js / token.service
let SYMBOL_MASTER = {}; // token -> { exchangeType, symbol }

// ==========================================
// LIVE LTP STORE (GLOBAL BUS)
// ==========================================
if (!global.latestLTP) global.latestLTP = {};

// ==========================================
// SYMBOL MASTER LINK
// ==========================================
function setSymbolMaster(map) {
  if (!map || typeof map !== "object") {
    console.log("⚠️ ENGINE: Invalid symbol master");
    return;
  }

  SYMBOL_MASTER = map;
  console.log(
    "🧠 ENGINE: Symbol master linked:",
    Object.keys(map).length
  );
}

// ==========================================
// LTP UPDATE
// ==========================================
function updateLtp(token, ltp) {
  global.latestLTP[token] = {
    ltp,
    time: Date.now()
  };
}

// ==========================================
// BINARY TICK DECODER (ANGEL FORMAT)
// ==========================================
function decodeBinaryTick(buffer) {
  try {
    // Angel sends ArrayBuffer / Buffer
    const buf = Buffer.from(buffer);

    /*
      Angel Binary Structure (LTP mode):
      [0..1]   = exchangeType (uint16)
      [2..5]   = token (uint32)
      [6..13]  = ltp (double / float64)
    */

    const exchangeType = buf.readUInt16BE(0);
    const token = buf.readUInt32BE(2);
    const ltp = buf.readDoubleBE(6);

    if (!token || !ltp) return null;

    return { exchangeType, token: String(token), ltp };
  } catch {
    return null;
  }
}

// ==========================================
// HEARTBEAT
// ==========================================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && wsConnected) {
      try {
        ws.send(JSON.stringify({ action: "ping" }));
      } catch {}
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// ==========================================
// TOKEN SUBSCRIBE (ANGEL LIMIT SAFE)
// 1000 tokens per WS message
// ==========================================
function subscribeTokens(tokenList) {
  if (!ws || !wsConnected || !Array.isArray(tokenList)) return;

  const CHUNK = 1000;

  for (let i = 0; i < tokenList.length; i += CHUNK) {
    const batch = tokenList.slice(i, i + CHUNK);

    const payload = {
      action: "subscribe",
      params: {
        mode: "LTP",
        tokenList: [
          {
            exchangeType: 2, // NFO default (Angel allows mixed tokens)
            tokens: batch.map(String)
          }
        ]
      }
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch {
      console.log("⚠️ ENGINE: WS chunk send failed");
      return;
    }
  }

  console.log("📡 ENGINE: Subscribed tokens:", tokenList.length);
}

// ==========================================
// WS CONNECT
// ==========================================
function connectWS(feedToken, clientCode, tokens) {
  console.log("🔌 ENGINE: Connecting Angel WS...");

  ws = new WebSocket(
    "wss://smartapisocket.angelone.in/smart-stream",
    {
      headers: {
        Authorization: `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
        "x-api-key": process.env.ANGEL_API_KEY,
        "x-client-code": clientCode,
        "x-feed-token": feedToken
      }
    }
  );

  ws.on("open", () => {
    wsConnected = true;
    console.log("🟢 ENGINE: WS Connected");
  });

  ws.on("message", (data) => {
    try {
      // AUTH CONFIRM (JSON)
      if (typeof data === "string") {
        const msg = JSON.parse(data);

        if (msg?.status === true && msg?.type === "cn") {
          console.log("🔓 ENGINE: WS AUTH SUCCESS");
          systemReady = true;
          startHeartbeat();
          subscribeTokens(tokens);
        }

        return;
      }

      // BINARY TICKS
      const tick = decodeBinaryTick(data);
      if (!tick) return;

      updateLtp(tick.token, tick.ltp);
    } catch {
      // silent
    }
  });

  ws.on("close", () => {
    console.log("🔴 ENGINE: WS Closed — reconnecting...");
    cleanupWS();
    reconnect(feedToken, clientCode, tokens);
  });

  ws.on("error", (err) => {
    console.log("❌ ENGINE: WS Error:", err.message);
    cleanupWS();
    reconnect(feedToken, clientCode, tokens);
  });
}

// ==========================================
// RECONNECT
// ==========================================
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

// ==========================================
// ENGINE BOOT
// ==========================================
async function startAngelEngine() {
  if (engineRunning) {
    console.log("⚠️ ENGINE: Already running");
    return;
  }

  engineRunning = true;
  console.log("🚀 ENGINE: Booting Angel Live Engine...");

  try {
   // 🔥 FULL SYMBOL MODE (Stock + FO + Commodity + Options)
const bundle = await fetchOptionTokens();

if (!bundle || !bundle.feedToken || !bundle.clientCode) {
  throw new Error("Invalid token bundle");
}

// Get ALL tokens from SYMBOL SERVICE
const allSymbols = getAllSymbols();

if (!Array.isArray(allSymbols) || allSymbols.length === 0) {
  throw new Error("No symbols available from Symbol Service");
}

// Extract token list
const tokens = allSymbols.map(s => String(s.token || s));

console.log("🧠 ENGINE: FULL MODE TOKENS READY:", tokens.length);

connectWS(
  bundle.feedToken,
  bundle.clientCode,
  tokens
);
    
  } catch (e) {
    engineRunning = false;
    console.log("❌ ENGINE: Boot failed:", e.message);
  }
}

// ==========================================
// STATUS
// ==========================================
function isSystemReady() {
  return systemReady;
}

function isWsConnected() {
  return wsConnected;
}

module.exports = {
  startAngelEngine,
  isSystemReady,
  isWsConnected,
  setSymbolMaster
};
