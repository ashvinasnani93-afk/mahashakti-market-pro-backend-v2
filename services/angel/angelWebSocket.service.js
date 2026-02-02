// ==========================================
// ANGEL ONE WEBSOCKET SERVICE
// Real-Time Market Data Feed
// Following Official Angel One WebSocket API
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
    // Binary data from Angel (51 bytes format)
    if (Buffer.isBuffer(data) && data.length === 51) {
      const ltp = decodeBinaryLTP(data);
      if (ltp && ltp.token) {
        updateLTP(ltp.token, ltp.price);
      }
    }
    // JSON message
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
// DECODE BINARY LTP (Angel Format)
// ==========================================
function decodeBinaryLTP(buffer) {  
  try {  
    // Angel sends 51 byte binary packets  
    // Bytes 43-46: LTP in paise (Int32LE)  
    const pricePaise = buffer.readInt32LE(43);  
    const price = pricePaise / 100;  
  
    // Extract token - FIXED REGEX  
  const tokenStr = buffer.toString("utf8", 2, 27).replace(/\0/g, "");
      
    return {  
      token: tokenStr,  
      price: price  
    };  
  } catch (err) {  
    return null;  
  }  
}

// ==========================================
// UPDATE LTP IN GLOBAL CACHE
// ==========================================
function updateLTP(token, price) {
  try {
    if (!token || !price) return;

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

// Mirror into global.latestLTP for API routes
    if (!global.latestLTP) {
      global.latestLTP = {};
    }

    global.latestLTP[token] = {
      ltp: Number(price),
      timestamp: Date.now()
    };

// ================================
// SYMBOL MIRROR FOR API ROUTES
// ================================
if (!global.tokenToSymbolMap) {
  global.tokenToSymbolMap = {};
}

const symbol = global.tokenToSymbolMap[token];
if (symbol) {
  if (!global.latestLTP) {
    global.latestLTP = {};
  }

  global.latestLTP[symbol] = {
    ltp: Number(price),
    timestamp: Date.now()
  };

  console.log(`📡 WS LTP → ${symbol} = ${price}`);
}
    
    // Initialize open price
    if (!global.symbolOpenPrice[token]) {
      global.symbolOpenPrice[token] = Number(price);
    }

  } catch (err) {
    console.error("❌ Update LTP Error:", err.message);
  }
}

// ==========================================
// SUBSCRIBE TO SYMBOLS
// ==========================================
function subscribeToSymbols() {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to NIFTY, BANKNIFTY, FINNIFTY
    const subscribePayload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: 1, // NSE
      tokens: ["99926000", "99926009", "99926037"] // NIFTY, BANKNIFTY, FINNIFTY
    };

    ws.send(JSON.stringify(subscribePayload));
    console.log("📡 Subscribed to Index symbols");

  } catch (err) {
    console.error("❌ Subscribe Error:", err.message);
  }
}

// ==========================================
// SUBSCRIBE BY SYMBOL (NSE / BSE / MCX SAFE)
// ==========================================
function subscribeBySymbol(token, exchange = "NSE") {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    let exchangeType = 1; // NSE default
    if (exchange === "BSE") exchangeType = 2;
    if (exchange === "MCX") exchangeType = 5;

    const payload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: exchangeType,
      tokens: [String(token)]
    };

    ws.send(JSON.stringify(payload));
    console.log(`📡 Subscribed WS → ${exchange} | Token: ${token}`);
    return true;

  } catch (err) {
    console.error("❌ SubscribeBySymbol Error:", err.message);
    return false;
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
  }, 25000); // Every 25 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ==========================================
// MCX COMMODITY SUBSCRIBE SUPPORT
// ==========================================
function subscribeCommodityToken(token) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("❌ WS not connected. Can't subscribe MCX token:", token);
      return false;
    }

    const payload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: 5, // 5 = MCX
      tokens: [String(token)]
    };

    ws.send(JSON.stringify(payload));
    console.log("🟡 MCX Token Subscribed:", token);
    return true;
  } catch (err) {
    console.log("❌ MCX Subscribe Error:", err.message);
    return false;
  }
}

// ==========================================
// SUBSCRIBE TO ADDITIONAL TOKEN
// ==========================================
function subscribeToToken(token, exchangeType = 1) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const payload = {
      action: "subscribe",
      mode: "LTP",
      exchangeType: exchangeType,
      tokens: [String(token)]
    };

    ws.send(JSON.stringify(payload));
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
  subscribeBySymbol,
  subscribeCommodityToken, // ✅ ADD
  setClientCode,
  setSessionTokens
};
