// ==========================================
// ANGEL SMARTAPI 2.0 WEBSOCKET ENGINE
// MAHASHAKTI MARKET PRO
// URL AUTH + HEARTBEAT + CHUNK SAFE + RECONNECT
// ==========================================

const WebSocket = require("ws");

let ws = null;
let tickHandler = null;
let pendingTokens = [];
let reconnectTimer = null;

// ================================
// BUILD WS URL (SMARTAPI 2.0 AUTH)
// ================================
function buildWSUrl() {
  const clientCode = process.env.ANGEL_CLIENT_ID;
  const apiKey = process.env.ANGEL_API_KEY;
  const feedToken = process.env.ANGEL_FEED_TOKEN;

  if (!clientCode || !apiKey || !feedToken) {
    throw new Error(
      "Missing ENV: ANGEL_CLIENT_ID / ANGEL_API_KEY / ANGEL_FEED_TOKEN"
    );
  }

  return `wss://smartapisocket.angelone.in/smart-stream?clientCode=${clientCode}&feedToken=${feedToken}&apiKey=${apiKey}`;
}

// ================================
// CONNECT ENGINE
// ================================
function connectAngelSocket(onTick) {
  tickHandler = onTick;

  try {
    const url = buildWSUrl();
    console.log("🔌 Connecting Angel WS...");
    ws = new WebSocket(url);
  } catch (e) {
    console.log("❌ WS Build URL Failed:", e.message);
    reconnect();
    return;
  }

  // ================================
  // OPEN
  // ================================
  ws.on("open", () => {
    console.log("🟢 Angel WebSocket CONNECTED");
    startHeartbeat();

    if (pendingTokens.length) {
      console.log("🚀 Subscribing pending tokens:", pendingTokens.length);
      subscribeTokens(pendingTokens);
      pendingTokens = [];
    }
  });

  // ================================
  // MESSAGE
  // ================================
  ws.on("message", (data) => {
    try {
      // Tick packets may be binary or JSON (errors)
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        // Binary tick — forward raw
        if (tickHandler) tickHandler(data);
        return;
      }

      // Error response
      if (msg?.errorCode) {
        console.log("⚠ Angel WS Error:", msg.errorCode, msg.errorMessage);
        return;
      }

      // Forward any JSON ticks if present
      if (tickHandler) tickHandler(msg);
    } catch (e) {
      // ignore noise
    }
  });

  // ================================
  // CLOSE
  // ================================
  ws.on("close", () => {
    console.log("🔴 Angel WebSocket CLOSED — reconnecting...");
    stopHeartbeat();
    reconnect();
  });

  // ================================
  // ERROR
  // ================================
  ws.on("error", (err) => {
    console.log("❌ Angel WS Error:", err.message);
    stopHeartbeat();
    reconnect();
  });
}

// ================================
// HEARTBEAT
// ================================
let heartbeatTimer = null;

function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === 1) {
      try {
        ws.send("ping");
        console.log("💓 WS Heartbeat Ping");
      } catch {
        console.log("⚠ WS Heartbeat Failed");
      }
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// ================================
// RECONNECT
// ================================
function reconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectAngelSocket(tickHandler);
  }, 5000);
}

// ================================
// SUBSCRIBE TOKENS (CHUNK SAFE)
// ================================
function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) {
    console.log("⏳ WS not ready — queueing tokens:", tokens.length);
    pendingTokens = tokens;
    return;
  }

  const CHUNK = 900; // Angel limit safe
  const exchangeType = 2; // NSE FO

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK).map(String);

    const payload = {
      correlationID: "mmpro_" + Date.now(),
      action: 1, // subscribe
      params: {
        mode: 1, // LTP
        tokenList: [
          {
            exchangeType,
            tokens: batch
          }
        ]
      }
    };

    try {
      ws.send(JSON.stringify(payload));
      console.log("📡 Subscribed batch:", batch.length);
    } catch {
      console.log("⚠ WS Send Failed — requeueing");
      pendingTokens = tokens;
      return;
    }
  }

  console.log("✅ Total Tokens Subscribed:", tokens.length);
}

// ================================
// EXPORTS
// ================================
module.exports = {
  connectAngelSocket,
  subscribeTokens
};
