const WebSocket = require("ws");

let ws = null;
let tickHandler = null;
let heartbeatTimer = null;
let reconnectTimer = null;

// ================================
// CONFIG
// ================================
const WS_URL = "wss://smartapisocket.angelone.in/smart-stream";
const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

// ================================
// CONNECT
// ================================
function connectAngelSocket(onTick) {
  tickHandler = onTick;

  try {
    const apiKey = process.env.ANGEL_API_KEY;
    const clientCode = process.env.ANGEL_CLIENT_ID;
    const feedToken = process.env.ANGEL_FEED_TOKEN;
    const accessToken = process.env.ANGEL_ACCESS_TOKEN;

    if (!apiKey || !clientCode || !feedToken || !accessToken) {
      console.log("❌ WS ENV MISSING:", {
        API: !!apiKey,
        CLIENT: !!clientCode,
        FEED: !!feedToken,
        ACCESS: !!accessToken
      });
      return;
    }

    console.log("🔗 Connecting Angel WS (HEADER MODE)...");

    ws = new WebSocket(WS_URL, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "x-api-key": apiKey,
        "x-client-code": clientCode,
        "x-feed-token": feedToken
      }
    });

  } catch (err) {
    console.log("❌ WS Build Failed:", err.message);
    return scheduleReconnect();
  }

  // ================================
  // OPEN
  // ================================
  ws.on("open", () => {
    console.log("🟢 Angel WebSocket CONNECTED");
    startHeartbeat();
  });

  // ================================
  // MESSAGE
  // ================================
  ws.on("message", (data) => {
    try {
      if (data.toString() === "pong") return;

      const msg = JSON.parse(data.toString());
      if (tickHandler) tickHandler(msg);
    } catch (e) {
      // Binary packets ignored here
    }
  });

  // ================================
  // CLOSE
  // ================================
  ws.on("close", () => {
    console.log("🔴 Angel WS CLOSED — reconnecting...");
    stopHeartbeat();
    scheduleReconnect();
  });

  // ================================
  // ERROR
  // ================================
  ws.on("error", (err) => {
    console.log("⚠ Angel WS Error:", err.message);
  });
}

// ================================
// HEARTBEAT
// ================================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === 1) {
      ws.send("ping");
      console.log("❤️ WS Heartbeat Ping");
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ================================
// RECONNECT
// ================================
function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectAngelSocket(tickHandler);
  }, RECONNECT_DELAY);
}

// ================================
// SUBSCRIBE (SAFE CHUNKING)
// ================================
function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) {
    console.log("⏳ WS not ready — skipping subscribe");
    return;
  }

  const CHUNK = 200;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK).map(String);

    const payload = {
      correlationID: "mahashakti-" + Date.now(),
      action: 1,
      params: {
        mode: 1, // LTP
        tokenList: [
          {
            exchangeType: 2, // NFO
            tokens: batch
          }
        ]
      }
    };

    ws.send(JSON.stringify(payload));
  }

  console.log("📡 Subscribed Tokens:", tokens.length);
}

// ================================
module.exports = {
  connectAngelSocket,
  subscribeTokens
};
