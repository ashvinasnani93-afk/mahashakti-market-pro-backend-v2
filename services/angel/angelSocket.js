const WebSocket = require("ws");

let ws = null;
let tickHandler = null;

const WS_URL = "wss://smartapis.angelone.in/smart-stream";

// ===============================
// CONNECT + AUTH FLOW
// ===============================
function connectAngelSocket(onTick) {
  tickHandler = onTick;

  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("📡 Angel WebSocket OPEN — sending AUTH");

    // 🔐 AUTH PAYLOAD (MANDATORY)
    const authPayload = {
      action: "authenticate",
      apiKey: process.env.ANGEL_API_KEY,
      clientCode: process.env.ANGEL_CLIENT_ID,
      feedToken:
        process.env.ANGEL_FEED_TOKEN || process.env.ANGEL_ACCESS_TOKEN
    };

    ws.send(JSON.stringify(authPayload));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // ✅ AUTH SUCCESS
      if (msg?.status === true && msg?.type === "AUTH") {
        console.log("🟢 Angel WebSocket AUTH SUCCESS");
        return;
      }

      // 📡 LIVE TICK
      if (tickHandler) tickHandler(msg);
    } catch (e) {
      console.log("⚠ WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("🔴 Angel WebSocket CLOSED — reconnecting...");
    setTimeout(() => connectAngelSocket(tickHandler), 3000);
  });

  ws.on("error", (err) => {
    console.log("⚠ Angel WS Error:", err.message);
  });
}

// ===============================
// SUBSCRIBE AFTER AUTH
// ===============================
function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) {
    console.log("⚠ WS not ready for subscribe");
    return;
  }

  console.log("📡 Subscribing tokens:", tokens.length);

  const payload = {
    action: "subscribe",
    mode: "LTP",
    tokens
  };

  ws.send(JSON.stringify(payload));
}

module.exports = {
  connectAngelSocket,
  subscribeTokens
};
