// ==========================================
// ANGEL ONE WEBSOCKET SERVICE
// Real-Time Market Data Feed
// FIXED VERSION - Auth Header + Stale Detection
// ==========================================

const WebSocket = require("ws");

let ws = null;
let heartbeatInterval = null;
let reconnectTimeout = null;
let staleCheckInterval = null;

// 🔒 GLOBAL MEMORY (58-FILE BASELINE COMPATIBLE)
let globalClientCode = null;
let globalFeedToken = null;
let globalApiKey = null;

// ==========================================
// ✅ FIX 1: TICK MONITORING VARIABLES
// ==========================================
let lastTickTimestamp = Date.now();
let tickCount = 0;

// ==========================================
// ADD: GLOBAL OHLC CACHE (MCX + NSE + BSE)
// ==========================================
if (!global.latestOHLC) {
  global.latestOHLC = {};
}

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

    // ==========================================
    // ✅ FIX 2: CORRECT AUTHORIZATION HEADER
    // Use jwtToken for Authorization, NOT feedToken
    // ==========================================
    ws = new WebSocket(wsUrl, {
      headers: {
        "Authorization": `Bearer ${global.angelSession.jwtToken}`,  // ✅ FIXED: Use jwtToken
        "x-api-key": globalApiKey,
        "x-client-code": globalClientCode,
        "x-feed-token": globalFeedToken  // feedToken goes here
      }
    });

    ws.on("open", () => {
      console.log("🟢 Angel WebSocket CONNECTED");

      if (!global.angelSession) {
        global.angelSession = {};
      }

      global.angelSession.wsConnected = true;
      lastTickTimestamp = Date.now();  // Reset on connect
      tickCount = 0;

      // Start heartbeat
      startHeartbeat();

      // ==========================================
      // ✅ FIX 3: START STALE CHECK AFTER OPEN
      // ==========================================
      startStaleCheck();

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
      stopStaleCheck();

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
    // ==========================================
    // ✅ FIX 4: UPDATE TICK TIMESTAMP ON EVERY MESSAGE
    // ==========================================
    lastTickTimestamp = Date.now();
    tickCount++;

    // Log every 100 ticks for verification
    if (tickCount % 100 === 0) {
      console.log(`📊 Tick count: ${tickCount}`);
    }

    // 51 BYTE LTP PACKETS
    if (Buffer.isBuffer(data) && data.length >= 51 && data.length < 140) {
      const ltp = decodeBinaryLTP(data);
      if (ltp && ltp.token) {
        updateLTP(ltp.token, ltp.price);
      }
    }

    // FULL / SNAPQUOTE PACKETS
    else if (Buffer.isBuffer(data) && data.length >= 140) {
      const ohlc = decodeBinaryFULL(data);
      if (ohlc && ohlc.token) {
        updateOHLC(ohlc);
      }
    }

    // JSON MESSAGE
    else {
      const message = JSON.parse(data.toString());

      if (message.action === "subscribe" && message.result === "success") {
        console.log("Subscription confirmed");
      }

      if (message.ltp) {
        updateLTP(message.token || message.symboltoken, message.ltp);
      }
    }

  } catch (err) {
    // Silent
  }
}

// ==========================================
// DECODE BINARY LTP (Angel Format)
// ==========================================
function decodeBinaryLTP(buffer) {
  try {
    // Bytes 43-46: LTP in paise (Int32LE)
    const pricePaise = buffer.readInt32LE(43);
    const price = pricePaise / 100;

    const tokenStr = buffer
      .toString("utf8", 2, 27)
      .replace(//g, "")
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
// DECODE FULL / SNAPQUOTE (REAL OHLC ONLY)
// NO DUMMY / NO FALLBACK VALUES
// ==========================================
function decodeBinaryFULL(buffer) {
  try {
    const tokenStr = buffer
      .toString("utf8", 2, 27)
      .replace(//g, "")
      .trim();

    const ltp = buffer.readInt32LE(43) / 100;
    const open = buffer.readInt32LE(47) / 100;
    const high = buffer.readInt32LE(51) / 100;
    const low = buffer.readInt32LE(55) / 100;
    const close = buffer.readInt32LE(59) / 100;
    const volume = buffer.readInt32LE(63);

    return {
      token: tokenStr,
      ltp,
      open,
      high,
      low,
      close,
      volume
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
    if (!token || price === undefined || price === null) return;

    if (!global.latestLTP) {
      global.latestLTP = {};
    }

    if (!global.symbolOpenPrice) {
      global.symbolOpenPrice = {};
    }

    global.latestLTP[token] = {
      ltp: Number(price),
      timestamp: Date.now()
    };

    if (!global.symbolOpenPrice[token]) {
      global.symbolOpenPrice[token] = Number(price);
    }

  } catch (err) {
    console.error("❌ Update LTP Error:", err.message);
  }
}

// ==========================================
// UPDATE OHLC IN GLOBAL CACHE (REAL DATA ONLY)
// ==========================================
function updateOHLC(data) {
  try {
    if (!data || !data.token) return;

    global.latestOHLC[data.token] = {
      ltp: Number(data.ltp),
      open: Number(data.open),
      high: Number(data.high),
      low: Number(data.low),
      close: Number(data.close),
      volume: Number(data.volume),
      timestamp: Date.now()
    };

    if (!global.latestLTP) {
      global.latestLTP = {};
    }

    global.latestLTP[data.token] = {
      ltp: Number(data.ltp),
      timestamp: Date.now()
    };

  } catch (err) {
    console.error("❌ Update OHLC Error:", err.message);
  }
}

// ==========================================
// SUBSCRIBE TO SYMBOLS
// ==========================================
function subscribeToSymbols() {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      action: 1,  // Subscribe action
      params: {
        mode: 1,  // LTP mode
        tokenList: [
          {
            exchangeType: 1,
            tokens: ["99926000", "99926009", "99926037"]  // NIFTY, BANKNIFTY, FINNIFTY
          }
        ]
      }
    };

    ws.send(JSON.stringify(payload));
    console.log("📡 Subscribed to Index symbols");
  } catch (err) {
    console.error("❌ Subscribe Error:", err.message);
  }
}

// ==========================================
// HEARTBEAT
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
// ✅ FIX 5: STALE CONNECTION CHECK
// ==========================================
function startStaleCheck() {
  stopStaleCheck();

  staleCheckInterval = setInterval(() => {
    const diff = Date.now() - lastTickTimestamp;

    console.log(`[WS] Heartbeat: Last tick ${Math.round(diff/1000)}s ago, Total ticks: ${tickCount}`);

    // If no ticks for 60 seconds, connection is stale
    if (diff > 60000) {
      console.log("⚠️ WebSocket STALE (no ticks for 60s). Force reconnecting...");
      
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          ws.terminate();
        }
      }
    }
  }, 30000);
}

function stopStaleCheck() {
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

// ==========================================
// SUBSCRIBE TO ADDITIONAL TOKEN (LTP MODE)
// ==========================================
function subscribeToToken(token, exchangeType = 1) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const payload = {
      action: 1,
      params: {
        mode: 1,
        tokenList: [
          {
            exchangeType: exchangeType,
            tokens: [String(token)]
          }
        ]
      }
    };
    ws.send(JSON.stringify(payload));

    // AUTO-UPGRADE MCX TO FULL MODE
    if (exchangeType === 5) {
      setTimeout(() => {
        subscribeFullToken(token, 5);
      }, 500);
    }

    return true;
  } catch (err) {
    console.error("❌ Subscribe Token Error:", err.message);
    return false;
  }
}

// ==========================================
// SUBSCRIBE FULL MODE (OHLC SUPPORT)
// ==========================================
function subscribeFullToken(token, exchangeType = 5) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const payload = {
      action: 1,
      params: {
        mode: 3,
        tokenList: [
          {
            exchangeType: exchangeType,
            tokens: [String(token)]
          }
        ]
      }
    };

    ws.send(JSON.stringify(payload));
    console.log("📊 FULL MODE Subscribed:", token);
    return true;

  } catch (err) {
    console.error("❌ FULL Subscribe Error:", err.message);
    return false;
  }
}

// ==========================================
// GET WEBSOCKET STATUS (NEW)
// ==========================================
function getWebSocketStatus() {
  return {
    connected: global.angelSession?.wsConnected || false,
    lastTickAge: Date.now() - lastTickTimestamp,
    tickCount: tickCount,
    isStale: (Date.now() - lastTickTimestamp) > 60000
  };
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  startAngelWebSocket,
  subscribeToToken,
  subscribeFullToken,
  setClientCode,
  setSessionTokens,
  getWebSocketStatus
};
