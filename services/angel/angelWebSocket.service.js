// ==========================================
// ANGEL ONE WEBSOCKET SERVICE
// DYNAMIC SUBSCRIPTION MODEL
// Memory Efficient - Subscribe only what's needed
// ==========================================

const WebSocket = require("ws");

// ==========================================
// CONNECTION STATE
// ==========================================
let ws = null;
let heartbeatInterval = null;
let reconnectTimeout = null;
let staleCheckInterval = null;
let isStarted = false;  // Prevent multiple starts

// GLOBAL MEMORY (58-FILE BASELINE COMPATIBLE)
let globalClientCode = null;
let globalFeedToken = null;
let globalApiKey = null;

// TICK MONITORING VARIABLES
let lastTickTimestamp = Date.now();
let tickCount = 0;

// ==========================================
// DYNAMIC SUBSCRIPTION MANAGEMENT
// ==========================================
const subscribedTokens = new Map();  // token -> { exchangeType, mode, refCount, lastUpdate }
const MAX_SUBSCRIPTIONS = 500;  // Safety limit

// ==========================================
// GLOBAL CACHES (LIMITED SIZE)
// ==========================================
if (!global.latestLTP) {
  global.latestLTP = {};
}
if (!global.latestOHLC) {
  global.latestOHLC = {};
}
if (!global.prevCloseCache) {
  global.prevCloseCache = {};
}

// ==========================================
// SET CLIENT CODE FROM AUTH SERVICE
// ==========================================
function setClientCode(clientCode) {
  globalClientCode = clientCode;
}

// ==========================================
// SET SESSION TOKENS
// ==========================================
function setSessionTokens(feedToken, apiKey) {
  globalFeedToken = feedToken;
  globalApiKey = apiKey;
}

// ==========================================
// START WEBSOCKET - RUNS ONLY ONCE
// ==========================================
function startAngelWebSocket(feedToken, clientCode, apiKey) {
  // Prevent multiple starts
  if (isStarted && ws && ws.readyState === WebSocket.OPEN) {
    console.log("[WS] Already running, skipping start");
    return;
  }

  try {
    globalFeedToken = feedToken;
    globalApiKey = apiKey;
    globalClientCode = clientCode;

    if (!globalClientCode) {
      throw new Error("Missing clientCode for WebSocket header");
    }

    // Close existing connection if any
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }

    console.log("[WS] Connecting to Angel WebSocket...");

    const wsUrl = "wss://smartapisocket.angelone.in/smart-stream";

    ws = new WebSocket(wsUrl, {
      headers: {
        "Authorization": "Bearer " + global.angelSession.jwtToken,
        "x-api-key": globalApiKey,
        "x-client-code": globalClientCode,
        "x-feed-token": globalFeedToken
      }
    });

    ws.on("open", function() {
      console.log("[WS] ✅ CONNECTED");
      isStarted = true;

      if (!global.angelSession) {
        global.angelSession = {};
      }
      global.angelSession.wsConnected = true;
      lastTickTimestamp = Date.now();
      tickCount = 0;

      startHeartbeat();
      startStaleCheck();

      // Subscribe to core indices only (3 tokens)
      subscribeToIndices();
    });

    ws.on("message", function(data) {
      try {
        handleWebSocketMessage(data);
      } catch (err) {
        // Silent
      }
    });

    ws.on("error", function(err) {
      console.error("[WS] Error:", err.message);
      if (global.angelSession) {
        global.angelSession.wsConnected = false;
      }
    });

    ws.on("close", function() {
      console.log("[WS] ❌ DISCONNECTED");
      isStarted = false;

      if (global.angelSession) {
        global.angelSession.wsConnected = false;
      }

      stopHeartbeat();
      stopStaleCheck();

      // Reconnect after 5 seconds
      reconnectTimeout = setTimeout(function() {
        console.log("[WS] Reconnecting...");
        startAngelWebSocket(globalFeedToken, globalClientCode, globalApiKey);
      }, 5000);
    });

  } catch (err) {
    console.error("[WS] Start Error:", err.message);
    isStarted = false;
  }
}

// ==========================================
// SUBSCRIBE TO CORE INDICES ONLY
// ==========================================
function subscribeToIndices() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Only 3 core indices
  var coreTokens = [
    { token: "99926000", symbol: "NIFTY" },
    { token: "99926009", symbol: "BANKNIFTY" },
    { token: "99926037", symbol: "FINNIFTY" }
  ];

  coreTokens.forEach(function(item) {
    subscribedTokens.set(item.token, {
      exchangeType: 1,
      mode: 1,
      refCount: 1,
      symbol: item.symbol,
      isPermanent: true  // Never unsubscribe
    });
  });

  var payload = {
    action: 1,
    params: {
      mode: 1,
      tokenList: [{
        exchangeType: 1,
        tokens: coreTokens.map(function(t) { return t.token; })
      }]
    }
  };

  ws.send(JSON.stringify(payload));
  console.log("[WS] Subscribed to 3 core indices");
}

// ==========================================
// DYNAMIC SUBSCRIBE - For Option Chain, Scanner, Search
// ==========================================
function subscribeTokens(tokens, source) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log("[WS] Not connected, cannot subscribe");
    return false;
  }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return false;
  }

  // Check subscription limit
  if (subscribedTokens.size + tokens.length > MAX_SUBSCRIPTIONS) {
    console.log("[WS] ⚠️ Subscription limit reached, cleaning old subscriptions");
    cleanupOldSubscriptions();
  }

  // Group by exchange type
  var nseTokens = [];
  var mcxTokens = [];

  tokens.forEach(function(t) {
    var token = String(t.token);
    var exchangeType = t.exchangeType || 1;

    // Check if already subscribed
    if (subscribedTokens.has(token)) {
      var existing = subscribedTokens.get(token);
      existing.refCount++;
      existing.lastUpdate = Date.now();
      subscribedTokens.set(token, existing);
    } else {
      subscribedTokens.set(token, {
        exchangeType: exchangeType,
        mode: t.mode || 1,
        refCount: 1,
        symbol: t.symbol || token,
        source: source,
        lastUpdate: Date.now()
      });

      if (exchangeType === 5) {
        mcxTokens.push(token);
      } else {
        nseTokens.push(token);
      }
    }
  });

  // Subscribe NSE tokens
  if (nseTokens.length > 0) {
    var nsePayload = {
      action: 1,
      params: {
        mode: 1,
        tokenList: [{
          exchangeType: 1,
          tokens: nseTokens
        }]
      }
    };
    ws.send(JSON.stringify(nsePayload));
    console.log("[WS] Subscribed " + nseTokens.length + " NSE tokens (" + source + ")");
  }

  // Subscribe MCX tokens
  if (mcxTokens.length > 0) {
    var mcxPayload = {
      action: 1,
      params: {
        mode: 3,  // Full mode for MCX
        tokenList: [{
          exchangeType: 5,
          tokens: mcxTokens
        }]
      }
    };
    ws.send(JSON.stringify(mcxPayload));
    console.log("[WS] Subscribed " + mcxTokens.length + " MCX tokens (" + source + ")");
  }

  console.log("[WS] Total subscriptions: " + subscribedTokens.size);
  return true;
}

// ==========================================
// UNSUBSCRIBE TOKENS - When leaving screen
// ==========================================
function unsubscribeTokens(tokens, source) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return false;
  }

  var tokensToUnsubscribe = [];

  tokens.forEach(function(t) {
    var token = String(t.token || t);

    if (subscribedTokens.has(token)) {
      var sub = subscribedTokens.get(token);
      
      // Don't unsubscribe permanent tokens (indices)
      if (sub.isPermanent) return;

      sub.refCount--;

      if (sub.refCount <= 0) {
        tokensToUnsubscribe.push({
          token: token,
          exchangeType: sub.exchangeType
        });
        subscribedTokens.delete(token);

        // Also remove from LTP cache to free memory
        if (global.latestLTP[sub.symbol]) {
          delete global.latestLTP[sub.symbol];
        }
      } else {
        subscribedTokens.set(token, sub);
      }
    }
  });

  // Send unsubscribe for NSE
  var nseUnsub = tokensToUnsubscribe.filter(function(t) { return t.exchangeType !== 5; });
  if (nseUnsub.length > 0) {
    var nsePayload = {
      action: 0,  // Unsubscribe
      params: {
        mode: 1,
        tokenList: [{
          exchangeType: 1,
          tokens: nseUnsub.map(function(t) { return t.token; })
        }]
      }
    };
    ws.send(JSON.stringify(nsePayload));
  }

  // Send unsubscribe for MCX
  var mcxUnsub = tokensToUnsubscribe.filter(function(t) { return t.exchangeType === 5; });
  if (mcxUnsub.length > 0) {
    var mcxPayload = {
      action: 0,
      params: {
        mode: 3,
        tokenList: [{
          exchangeType: 5,
          tokens: mcxUnsub.map(function(t) { return t.token; })
        }]
      }
    };
    ws.send(JSON.stringify(mcxPayload));
  }

  if (tokensToUnsubscribe.length > 0) {
    console.log("[WS] Unsubscribed " + tokensToUnsubscribe.length + " tokens (" + source + ")");
    console.log("[WS] Remaining subscriptions: " + subscribedTokens.size);
  }

  return true;
}

// ==========================================
// CLEANUP OLD SUBSCRIPTIONS (FIFO)
// ==========================================
function cleanupOldSubscriptions() {
  var now = Date.now();
  var threshold = 5 * 60 * 1000;  // 5 minutes
  var tokensToRemove = [];

  subscribedTokens.forEach(function(data, token) {
    if (data.isPermanent) return;
    if (now - data.lastUpdate > threshold) {
      tokensToRemove.push({ token: token, exchangeType: data.exchangeType });
    }
  });

  if (tokensToRemove.length > 0) {
    unsubscribeTokens(tokensToRemove, "cleanup");
    console.log("[WS] Cleaned up " + tokensToRemove.length + " stale subscriptions");
  }
}

// ==========================================
// HANDLE WEBSOCKET MESSAGE
// ==========================================
function handleWebSocketMessage(data) {
  lastTickTimestamp = Date.now();
  tickCount++;

  if (tickCount % 500 === 0) {
    console.log("[WS] Tick count: " + tickCount + ", Subscriptions: " + subscribedTokens.size);
  }

  // 51 BYTE LTP PACKETS
  if (Buffer.isBuffer(data) && data.length >= 51 && data.length < 140) {
    var ltp = decodeBinaryLTP(data);
    if (ltp && ltp.token) {
      updateLTP(ltp.token, ltp.price);
    }
  }
  // FULL / SNAPQUOTE PACKETS
  else if (Buffer.isBuffer(data) && data.length >= 140) {
    var ohlc = decodeBinaryFULL(data);
    if (ohlc && ohlc.token) {
      updateOHLC(ohlc);
    }
  }
  // JSON MESSAGE
  else {
    try {
      var message = JSON.parse(data.toString());
      if (message.ltp) {
        updateLTP(message.token || message.symboltoken, message.ltp);
      }
    } catch (e) {}
  }
}

// ==========================================
// DECODE BINARY LTP
// ==========================================
function decodeBinaryLTP(buffer) {
  try {
    var pricePaise = buffer.readInt32LE(43);
    var price = pricePaise / 100;

    var tokenStr = buffer.toString("utf8", 2, 27);
    tokenStr = tokenStr.split(String.fromCharCode(0)).join("").trim();

    return { token: tokenStr, price: price };
  } catch (err) {
    return null;
  }
}

// ==========================================
// DECODE FULL / SNAPQUOTE
// ==========================================
function decodeBinaryFULL(buffer) {
  try {
    var tokenStr = buffer.toString("utf8", 2, 27);
    tokenStr = tokenStr.split(String.fromCharCode(0)).join("").trim();

    return {
      token: tokenStr,
      ltp: buffer.readInt32LE(43) / 100,
      open: buffer.readInt32LE(47) / 100,
      high: buffer.readInt32LE(51) / 100,
      low: buffer.readInt32LE(55) / 100,
      close: buffer.readInt32LE(59) / 100,
      volume: buffer.readInt32LE(63)
    };
  } catch (err) {
    return null;
  }
}

// ==========================================
// UPDATE LTP - Limited Cache Size
// ==========================================
function updateLTP(token, price) {
  if (!token || price === undefined || price === null) return;

  var sub = subscribedTokens.get(token);
  var symbol = sub ? sub.symbol : token;

  var ltp = Number(price);
  var prevClose = global.prevCloseCache[symbol] || null;

  var change = null;
  var percent = null;

  if (prevClose && prevClose !== 0) {
    change = ltp - prevClose;
    percent = (change / prevClose) * 100;
  }

  global.latestLTP[symbol] = {
    ltp: ltp,
    prevClose: prevClose,
    change: change,
    percent: percent,
    timestamp: Date.now()
  };

  global.latestLTP[token] = global.latestLTP[symbol];
}

// ==========================================
// UPDATE OHLC
// ==========================================
function updateOHLC(data) {
  if (!data || !data.token) return;

  var sub = subscribedTokens.get(data.token);
  var symbol = sub ? sub.symbol : data.token;

  // Save prevClose from FULL packet
if (data.close !== undefined && data.close !== null) {
  global.prevCloseCache[symbol] = Number(data.close);
}

  global.latestOHLC[symbol] = {
    ltp: Number(data.ltp),
    open: Number(data.open),
    high: Number(data.high),
    low: Number(data.low),
    close: Number(data.close),
    volume: Number(data.volume),
    timestamp: Date.now()
  };

  global.latestLTP[symbol] = {
    ltp: Number(data.ltp),
    timestamp: Date.now()
  };
}

// ==========================================
// HEARTBEAT
// ==========================================
function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch (err) {}
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
// STALE CONNECTION CHECK
// ==========================================
function startStaleCheck() {
  stopStaleCheck();
  staleCheckInterval = setInterval(function() {
    var diff = Date.now() - lastTickTimestamp;
    console.log("[WS] Heartbeat: " + Math.round(diff/1000) + "s ago, Subs: " + subscribedTokens.size + ", Ticks: " + tickCount);

    if (diff > 60000) {
      console.log("[WS] ⚠️ STALE - reconnecting...");
      if (ws) {
        try { ws.close(); } catch (e) { ws.terminate(); }
      }
    }

    // Periodic cleanup
    if (subscribedTokens.size > 300) {
      cleanupOldSubscriptions();
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
// LEGACY: SUBSCRIBE SINGLE TOKEN
// ==========================================
function subscribeToToken(token, exchangeType) {
  return subscribeTokens([{
    token: token,
    exchangeType: exchangeType || 1
  }], "single");
}

// ==========================================
// LEGACY: SUBSCRIBE FULL MODE
// ==========================================
function subscribeFullToken(token, exchangeType) {
  return subscribeTokens([{
    token: token,
    exchangeType: exchangeType || 5,
    mode: 3
  }], "full");
}

// ==========================================
// GET WEBSOCKET STATUS
// ==========================================
function getWebSocketStatus() {
  return {
    connected: global.angelSession ? global.angelSession.wsConnected : false,
    lastTickAge: Date.now() - lastTickTimestamp,
    tickCount: tickCount,
    subscriptionCount: subscribedTokens.size,
    isStale: (Date.now() - lastTickTimestamp) > 60000,
    ltpCacheSize: Object.keys(global.latestLTP).length
  };
}

// ==========================================
// GET SUBSCRIPTION COUNT
// ==========================================
function getSubscriptionCount() {
  return subscribedTokens.size;
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  startAngelWebSocket: startAngelWebSocket,
  subscribeToToken: subscribeToToken,
  subscribeFullToken: subscribeFullToken,
  subscribeTokens: subscribeTokens,
  unsubscribeTokens: unsubscribeTokens,
  setClientCode: setClientCode,
  setSessionTokens: setSessionTokens,
  getWebSocketStatus: getWebSocketStatus,
  getSubscriptionCount: getSubscriptionCount
};
