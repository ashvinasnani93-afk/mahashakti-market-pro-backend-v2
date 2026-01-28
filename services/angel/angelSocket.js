const WebSocket = require("ws");

let ws = null;
let tickHandler = null;

function connectAngelSocket(onTick) {
  tickHandler = onTick;

  ws = new WebSocket("wss://smartapis.angelone.in/smart-stream");

  ws.on("open", () => {
    console.log("📡 Angel WebSocket OPEN");
  });

  ws.on("message", (data) => {
    try {
      const tick = JSON.parse(data.toString());
      if (tickHandler) tickHandler(tick);
    } catch (e) {}
  });

  ws.on("close", () => {
    console.log("🔴 Angel WebSocket CLOSED — reconnecting...");
    setTimeout(() => connectAngelSocket(tickHandler), 3000);
  });

  ws.on("error", (err) => {
    console.log("⚠ Angel WS Error:", err.message);
  });
}

function subscribeTokens(tokens = []) {
  if (!ws || ws.readyState !== 1) return;

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
