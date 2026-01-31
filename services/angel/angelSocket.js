const WebSocket = require("ws");

let ws = null;
let tickHandler = null;
let isAuthed = false;
let pendingTokens = [];
let heartbeatTimer = null;
let reconnectTimer = null;

// ===============================
// CONFIG
// ===============================
const WS_URL = "wss://smartapis.angelone.in/smart-stream";
const HEARTBEAT_INTERVAL = 10000;
const RECONNECT_DELAY = 3000;

// ===============================
// CONNECT
// ===============================
function connectAngelSocket(onTick) {
  tickHandler = onTick;

  console.log("🔌 Connecting Angel Market WS...");

  if (ws) {
    try {
      ws.close();
    } catch (e) {}
  }

  ws = new WebSocket(WS_URL);

  // -------------------------------
  // OPEN
  // -------------------------------
  ws.on("open", () => {
    console.log("🟢 Angel Market WS OPEN");
    authenticate();
    startHeartbeat();
  });

  // -------------------------------
  // MESSAGE
  // -------------------------------
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // AUTH CONFIRM
      if (msg?.status === true && msg?.type === "cn") {
        isAuthed = true;
        console.log("🔐 Angel WS AUTH SUCCESS");

        if (pendingTokens.length) {
          console.log("📡 Auto subscribing:", pendingTokens.length);
          subscribeTokens(pendingTokens);
          pendingTokens = [];
        }
        return;
      }

      // TICK DATA
      if (tickHandler) {
        tickHandler(msg);
      }
    } catch (e) {
      // ignore binary/ping frames
    }
  });

  // -------------------------------
  // CLOSE
  // -------------------------------
  ws.on("close", () => {
    console.log("🔴 Angel Market WS CLOSED — reconnecting...");
    stopHeartbeat();
    isAuthed = false;
    scheduleReconnect();
  });

  // -------------------------------
  // ERROR
  // -------------------------------
  ws.on("error", (err) => {
    console.log("⚠ Angel Market WS Error:", err.message);
  });
}

// ===============================
// AUTH (DOC METHOD)
// ===============================
function authenticate() {
  if (!ws || ws.readyState !== 1) return;

  const feedToken = process.env.ANGEL_FEED_TOKEN;
  const clientCode = process.env.ANGEL_CLIENT_ID;

  if (!feedToken || !clientCode) {
    console.log("❌ WS AUTH FAILED — Missing FEED_TOKEN / CLIENT_ID", {
      FEED: !!feedToken,
      CLIENT: !!clientCode
    });
    return;
  }

  const payload = {
    action: "authenticate",
    params: {
      feedToken,
      clientCode
    }
  };

  ws.send(JSON.stringify(payload));
  console.log("🔐 Angel WS AUTH SENT");
}

// ===============================
// HEARTBEAT (DOC FORMAT)
// ===============================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ action: "ping" }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ===============================
// RECONNECT
// ===============================
function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectAngelSocket(tickHandler);
  }, RECONNECT_DELAY);
}

// ===============================
// SUBSCRIBE (38K SAFE CHUNKING)
// ===============================
function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) {
    console.log("⏳ WS not ready — queueing tokens:", tokens.length);
    pendingTokens = tokens;
    return;
  }

  if (!isAuthed) {
    console.log("⏳ WS not authed — queueing tokens:", tokens.length);
    pendingTokens = tokens;
    return;
  }

  const CHUNK = 200;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK).map(String);

    const payload = {
      action: "subscribe",
      params: {
        mode: "LTP",
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

// ===============================
module.exports = {
  connectAngelSocket,
  subscribeTokens
};
