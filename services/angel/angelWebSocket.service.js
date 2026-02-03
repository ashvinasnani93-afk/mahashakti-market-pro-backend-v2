// ==========================================
// ANGEL ONE WEBSOCKET SERVICE
// Real-Time Market Data Feed
// FIXED VERSION - Binary Decode Fix
// NSE/BSE 51 bytes + MCX FLEX SUPPORT (ADD ONLY)
// ==========================================

const WebSocket = require("ws");

let ws = null;
let heartbeatInterval = null;
let reconnectTimeout = null;

// 🔒 GLOBAL MEMORY (58-FILE BASELINE COMPATIBLE)
let globalClientCode = null;
let globalFeedToken = null;
let globalApiKey = null;

// ==========================================
// SET CLIENT CODE FROM AUTH SERVICE
// ==========================================
function setClientCode(clientCode) {
  globalClientCode = clientCode;
}

// ==========================================
// SET SESSION TOKENS (SAFE RECONNECT SUPPORT)
// ==========================================
function setSessionTokens(feedToken, apiKey) {
  globalFeedToken = feedToken;
  globalApiKey = apiKey;
}

// ==========================================
// START WEBSOCKET CONNECTION
// ==========================================
function startAngelWebSocket(feedToken, clientCode, apiKey) {
  try {
    // Store for reconnects
    globalFeedToken = feedToken;
    globalApiKey = apiKey;
    globalClientCode = clientCode;

    if (!globalClientCode) {
      throw new Error("Missing clientCode for WebSocket header");
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("⚠️ WebSocket already connected");
      return;
    }

    console.log("🔌 Connecting to Angel WebSocket...");

    const wsUrl = `wss://smartapisocket.angelone.in/smart-stream`;

    ws = new WebSocket(wsUrl, {
      headers: {
        "Authorization": `Bearer ${globalFeedToken}`,
        "x-api-key": globalApiKey,
        "x-client-code": globalClientCode,
        "x-feed-token": globalFeedToken
      }
    });

    ws.on("open", () => {
      console.log("🟢 Angel WebSocket CONNECTED");

      if (!global.angelSession) {
        global.angelSession = {};
      }

      global.angelSession.wsConnected = true;

      // Start heartbeat
      startHeartbeat();

      // Subscribe to default symbols
      subscribeToSymbols();
    });

    ws.on("message", (data) => {
      try {
        handleWebSocketMessage(data);
      } catch (err) {
        console.error("❌ WS Message Error:", err.message);
      }
    });

    ws.on("error", (err) => {
      console.error("❌ WebSocket Error:", err.message);
      if (global.angelSession) {
        global.angelSession.wsConnected = false;
      }
    });

    ws.on("close", () => {
      console.log("🔴 WebSocket DISCONNECTED");

      if (global.angelSession) {
        global.angelSession.wsConnected = false;
      }

      stopHeartbeat();

      // Reconnect after 5 seconds (SAFE RECONNECT)
      reconnectTimeout = setTimeout(() => {
        console.log("🔄 Reconnecting WebSocket...");
        startAngelWebSocket(
          globalFeedToken,
          globalClientCode,
          globalApiKey
        );
      }, 5000);
    });

  } catch (err) {
    console.error("❌ WebSocket Start Error:", err.message);
  }
}

// ==========================================
// HANDLE WEBSOCKET MESSAGE
// ==========================================
function handleWebSocketMessage(data) {
  try {
    // ================================
    // BINARY PATH (NSE/BSE + MCX)
    // ================================
    if (Buffer.isBuffer(data)) {

      // FAST PATH → NSE / BSE (51 bytes)
      if (data.length === 51) {
        const ltp = decodeBinaryLTP(data);
        if (ltp && ltp.token) {
          updateLTP(ltp.token, ltp.price);
        }
      }

      // FLEX PATH → MCX (90–140 bytes approx)
      else if (data.length > 60) {
        const ltp = decodeBinaryLTP_MCX(data);
        if (ltp && ltp.token) {
          updateLTP(ltp.token, ltp.price);
        }
      }
    }

    // ================================
    // JSON PATH (Fallback / MCX)
    // ================================
    else {
      const message = JSON.parse(data.toString());

      if (message.action === "subscribe" && message.result === "success") {
        console.log("✅ Subscription confirmed");
      }

      if (message.ltp) {
        updateLTP(message.token || message.symboltoken, message.ltp);
      }
    }

  } catch (err) {
    // Silent error for binary decode failures
  }
}

// ==========================================
// DECODE BINARY LTP (NSE / BSE 51 BYTES)
// ==========================================
function decodeBinaryLTP(buffer) {
  try {
    // Angel sends 51 byte binary packets
    // Bytes 43-46: LTP in paise (Int32LE)
    const pricePaise = buffer.readInt32LE(43);
    const price = pricePaise / 100;

    // Extract token (clean null bytes properly)
    const tokenStr = buffer
      .toString("utf8", 2, 27)
      .replace(/\0/g, "")
      .trim();

    return {
      token: tokenStr,
      price: price
    };

  } catch (err) {
    return null;
  }
}

// ==========================================
// DECODE BINARY LTP (MCX FLEX FORMAT)
// ==========================================
function decodeBinaryLTP_MCX(buffer) {
  try {
    // MCX packets are NOT fixed length
    // Angel docs: token usually starts near byte 2
    // price is near the end (last 4 bytes Int32LE)

    const pricePaise = buffer.readInt32LE(buffer.length - 4);
    const price = pricePaise / 100;

    const tokenStr = buffer
      .toString("utf8", 2, 30)
      .replace(/\0/g, "")
      .trim();

    return {
      token: tokenStr,
      price: price
    };

  } catch (err) {
    return null;
  }
}

// ==========================================
// UPDATE LTP IN GLOBAL CACHE (OHLC SAFE)
// ==========================================
function updateLTP(token, price) {
  try {
    // FIX: allow price = 0
    if (!token || price === undefined || price === null) return;

    if (!global.latestLTP) {
      global.latestLTP = {};
    }

    if (!global.symbolOpenPrice) {
      global.symbolOpenPrice = {};
    }

    // Store by token
    global.latestLTP[token] = {
      ltp: Number(price),
      timestamp: Date.now()
    };

    // Initialize open price (DO NOT TOUCH OHLC LOGIC)
    if (!global.symbolOpenPrice[token]) {
      global.symbolOpenPrice[token] = Number(price);
    }

  } catch (err) {
    console.error("❌ Update LTP Error:", err.message);
  }
}

// ==========================================
// SUBSCRIBE TO SYMBOLS (NSE DEFAULT)
// ==========================================
function subscribeToSymbols() {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to NIFTY, BANKNIFTY, FINNIFTY
    const subscribePayload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: 1, // NSE
      tokens: ["99926000", "99926009", "99926037"]
    };

    ws.send(JSON.stringify(subscribePayload));
    console.log("📡 Subscribed to Index symbols");

  } catch (err) {
    console.error("❌ Subscribe Error:", err.message);
  }
}

// ==========================================
// HEARTBEAT (Keep Connection Alive)
// ==========================================
function startHeartbeat() {
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch (err) {
        console.error("❌ Heartbeat Error:", err.message);
      }
    }
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ==========================================
// SUBSCRIBE TO ADDITIONAL TOKEN (NSE/BSE/MCX)
// ==========================================
function subscribeToToken(token, exchangeType = 1) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const payload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: exchangeType, // 1=NSE, 2=BSE, 5=MCX
      tokens: [String(token)]
    };

    ws.send(JSON.stringify(payload));

    console.log(`📡 Subscribed WS → exchangeType=${exchangeType} token=${token}`);
    return true;

  } catch (err) {
    console.error("❌ Subscribe Token Error:", err.message);
    return false;
  }
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  startAngelWebSocket,
  subscribeToToken,
  setClientCode,
  setSessionTokens
};
