const WebSocket = require("ws");

let ws = null;
let tickHandler = null;
let isAuthed = false;
let pendingTokens = [];

// ===================================================
// CONNECT + AUTH FIRST, THEN SUBSCRIBE (STABLE FLOW)
// ===================================================
function connectAngelSocket(onTick) {
  tickHandler = onTick;

  ws = new WebSocket("wss://smartapis.angelone.in/smart-stream");

  ws.on("open", () => {
    console.log("📡 Angel WebSocket OPEN");
    authenticate();
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // =========================
      // AUTH CONFIRM
      // =========================
      if (msg?.status === true && msg?.type === "cn") {
        isAuthed = true;
        console.log("🔐 Angel WS AUTH SUCCESS");

        // Auto subscribe after auth
        if (pendingTokens.length) {
          console.log("🚀 Auto-subscribing after AUTH:", pendingTokens.length);
          subscribeTokens(pendingTokens);
          pendingTokens = [];
        }
        return;
      }

      // =========================
      // TICKS
      // =========================
      if (tickHandler) {
        tickHandler(msg);
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("🔴 Angel WebSocket CLOSED — reconnecting...");
    isAuthed = false;

    setTimeout(() => {
      connectAngelSocket(tickHandler);
    }, 3000);
  });

  ws.on("error", (err) => {
    console.log("⚠ Angel WS Error:", err.message);
  });
}

// ===================================================
// AUTH PAYLOAD (MANDATORY FOR STABILITY)
// ===================================================
function authenticate() {
  if (!ws || ws.readyState !== 1) return;

  const feedToken =
    process.env.ANGEL_FEED_TOKEN ||
    process.env.ANGEL_ACCESS_TOKEN;

  const clientCode = process.env.ANGEL_CLIENT_ID;

  if (!feedToken || !clientCode) {
    console.log("❌ WS AUTH FAILED: Missing FEED_TOKEN / CLIENT_ID");
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

// ===================================================
// SUBSCRIBE TOKENS (ONLY AFTER AUTH, SAFE CHUNKING)
// ===================================================
function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) return;

  if (!isAuthed) {
    console.log("⏳ WS not authed yet — queuing tokens:", tokens.length);
    pendingTokens = tokens;
    return;
  }

  // Angel limit safe chunk size
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

  console.log("📡 Subscribed Tokens (Angel format):", tokens.length);
}

module.exports = {
  connectAngelSocket,
  subscribeTokens
};
