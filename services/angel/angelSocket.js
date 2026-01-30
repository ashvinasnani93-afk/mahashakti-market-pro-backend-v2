const WebSocket = require("ws");

let ws = null;
let tickHandler = null;
let isConnected = false;

// ==========================================
// CONNECT ANGEL SMART SOCKET (REAL PROTOCOL)
// ==========================================
function connectAngelSocket({ clientCode, feedToken, apiKey }, onTick) {
  if (!clientCode || !feedToken || !apiKey) {
    throw new Error("Angel socket credentials missing");
  }

  tickHandler = onTick;

  const wsUrl =
    `wss://smartapisocket.angelone.in/smart-stream` +
    `?clientCode=${clientCode}` +
    `&feedToken=${feedToken}` +
    `&apiKey=${apiKey}`;

  console.log("📡 Connecting Angel WebSocket...");

  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    isConnected = true;
    console.log("🟢 Angel WebSocket CONNECTED");
  });

  ws.on("message", (data) => {
    try {
      // Angel sends binary buffers
      if (Buffer.isBuffer(data)) {
        if (tickHandler) tickHandler(data);
      }
    } catch (e) {
      console.log("⚠ WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    isConnected = false;
    console.log("🔴 Angel WebSocket CLOSED — reconnecting...");
    setTimeout(() => {
      connectAngelSocket({ clientCode, feedToken, apiKey }, tickHandler);
    }, 5000);
  });

  ws.on("error", (err) => {
    console.log("⚠ Angel WS Error:", err.message);
  });
}

// ==========================================
// SUBSCRIBE TOKENS (ANGEL FORMAT)
// ==========================================
function subscribeTokens(tokens = [], exchangeType = 2) {
  if (!ws || ws.readyState !== 1) {
    console.log("⚠ WS not ready for subscription");
    return;
  }

  if (!Array.isArray(tokens) || !tokens.length) {
    console.log("⚠ No tokens to subscribe");
    return;
  }

  const payload = {
    action: 1,
    params: {
      mode: 1, // 1 = LTP
      tokenList: [
        {
          exchangeType, // 1=NSE, 2=NFO, 3=BSE
          tokens: tokens.map(String)
        }
      ]
    }
  };

  console.log("📡 Subscribing tokens:", tokens.length);

  ws.send(JSON.stringify(payload));
}

// ==========================================
// STATUS
// ==========================================
function isWsConnected() {
  return isConnected;
}

module.exports = {
  connectAngelSocket,
  subscribeTokens,
  isWsConnected
};
