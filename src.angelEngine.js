// ==========================================
// ANGEL LIVE DATA ENGINE — ENTERPRISE GRADE
// MAHASHAKTI MARKET PRO
// WS 2.0 | MIXED TOKEN SUBSCRIBE | HEARTBEAT | RECONNECT
// ==========================================

const WebSocket = require("ws");
const { fetchOptionTokens } = require("./services/angel/angelTokens");
const { getAllSymbols } = require("./symbol.service");

// ==========================================
let ws = null;
let wsConnected = false;
let systemReady = false;
let engineRunning = false;
let heartbeatTimer = null;
let reconnectTimer = null;

// token -> { exchangeType, symbol }
let SYMBOL_MASTER = {};

// ==========================================
if (!global.latestLTP) global.latestLTP = {};

// ==========================================
function setSymbolMaster(map) {
  if (!map || typeof map !== "object") return;
  SYMBOL_MASTER = map;
  console.log("🧠 ENGINE: Symbol master linked:", Object.keys(map).length);
}

// ==========================================
function updateLtp(token, exchangeType, ltp) {
  global.latestLTP[token] = {
    token,
    exchangeType,
    ltp,
    time: Date.now()
  };
}

// ==========================================
// BINARY DECODER
// ==========================================
function decodeBinaryTick(buffer) {
  try {
    const buf = Buffer.from(buffer);

    const exchangeType = buf.readUInt16BE(0);
    const token = String(buf.readUInt32BE(2));
    const ltp = buf.readDoubleBE(6);

    if (!token || !ltp) return null;
    return { exchangeType, token, ltp };
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
// MIXED TOKEN SUBSCRIBE
// ==========================================
function subscribeTokens(symbols) {
  if (!ws || !wsConnected || !Array.isArray(symbols)) return;

  const CHUNK = 1000;
  const grouped = {};

  // group by exchangeType
  for (const s of symbols) {
    if (!s?.token || s.exchangeType === undefined) continue;
    if (!grouped[s.exchangeType]) grouped[s.exchangeType] = [];
    grouped[s.exchangeType].push(String(s.token));
  }

  for (const exchangeType of Object.keys(grouped)) {
    const tokens = grouped[exchangeType];

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const batch = tokens.slice(i, i + CHUNK);

      const payload = {
        action: "subscribe",
        params: {
          mode: "LTP",
          tokenList: [
            {
              exchangeType: Number(exchangeType),
              tokens: batch
            }
          ]
        }
      };

      try {
        ws.send(JSON.stringify(payload));
      } catch {
        console.log("⚠️ ENGINE: WS send failed");
        return;
      }
    }

    console.log(
      `📡 ENGINE: Subscribed ${tokens.length} tokens for EXCHANGE`,
      exchangeType
    );
  }
}

// ==========================================
function connectWS(feedToken, clientCode, symbols) {
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
      if (typeof data === "string") {
        const msg = JSON.parse(data);

        if (msg?.status === true && msg?.type === "cn") {
          console.log("🔓 ENGINE: WS AUTH SUCCESS");
          systemReady = true;
          startHeartbeat();
          subscribeTokens(symbols);
        }
        return;
      }

      const tick = decodeBinaryTick(data);
      if (!tick) return;

      updateLtp(tick.token, tick.exchangeType, tick.ltp);
    } catch {}
  });

  ws.on("close", () => {
    console.log("🔴 ENGINE: WS Closed — reconnecting...");
    cleanupWS();
    reconnect(feedToken, clientCode, symbols);
  });

  ws.on("error", () => {
    cleanupWS();
    reconnect(feedToken, clientCode, symbols);
  });
}

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

function reconnect(feedToken, clientCode, symbols) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWS(feedToken, clientCode, symbols);
  }, 5000);
}

// ==========================================
async function startAngelEngine() {
  if (engineRunning) return;
  engineRunning = true;

  console.log("🚀 ENGINE: Booting Angel Live Engine...");

  try {
    const bundle = await fetchOptionTokens();
    if (!bundle?.feedToken || !bundle?.clientCode) {
      throw new Error("Invalid token bundle");
    }

    const symbols = getAllSymbols();
    if (!symbols.length) throw new Error("No symbols from Symbol Service");

    console.log("🧠 ENGINE: FULL MODE SYMBOLS:", symbols.length);

    connectWS(
      bundle.feedToken,
      bundle.clientCode,
      symbols
    );
  } catch (e) {
    engineRunning = false;
    console.log("❌ ENGINE: Boot failed:", e.message);
  }
}

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
