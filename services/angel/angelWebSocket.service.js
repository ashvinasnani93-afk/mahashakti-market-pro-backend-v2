// ==========================================
// ANGEL ONE WEBSOCKET SERVICE - PRODUCTION GRADE
// WITH RATE LIMIT PROTECTION & SINGLETON GUARD
// ==========================================

const SmartAPI = require("smartapi-javascript");
const EventEmitter = require("events");

// ==========================================
// ANGEL ONE WEBSOCKET RATE LIMITS
// ==========================================
// Official Angel One WS Limits:
// - Max 3 connections per user
// - Max 50 subscriptions per connection
// - Reconnect throttle: 5 seconds minimum
// - Rate limit error: 429 (Too Many Requests)

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 50;
const RECONNECT_THROTTLE_MS = 10000; // 10 seconds backoff
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ==========================================
// SINGLETON GUARD - PREVENT DOUBLE START
// ==========================================
let wsInstance = null;
let isConnecting = false;
let isConnected = false;
let reconnectAttempts = 0;
let lastReconnectTime = 0;
let reconnectTimer = null;
let heartbeatTimer = null;

// ==========================================
// SUBSCRIPTION MANAGEMENT
// ==========================================
const activeSubscriptions = new Map(); // token -> { symbol, exchangeType, mode }
let totalSubscriptionCount = 0;

// ==========================================
// WS STATUS TRACKING
// ==========================================
let wsStatus = {
  connected: false,
  lastTick: null,
  tickCount: 0,
  subscriptionCount: 0,
  lastError: null,
  reconnectAttempts: 0
};

// ==========================================
// EVENT EMITTER
// ==========================================
const wsEmitter = new EventEmitter();

// ==========================================
// CONNECT TO ANGEL WEBSOCKET (SINGLETON)
// ==========================================
async function connectWebSocket(jwtToken, apiKey, clientCode, feedToken) {
  // SINGLETON GUARD
  if (isConnecting) {
    console.log("[WS] ⚠️ Connection already in progress, skipping");
    return { success: false, message: "Connection in progress" };
  }

  if (isConnected && wsInstance) {
    console.log("[WS] ⚠️ Already connected");
    return { success: true, message: "Already connected" };
  }

  // RECONNECT THROTTLING
  const now = Date.now();
  const timeSinceLastReconnect = now - lastReconnectTime;
  
  if (timeSinceLastReconnect < RECONNECT_THROTTLE_MS) {
    const waitTime = RECONNECT_THROTTLE_MS - timeSinceLastReconnect;
    console.log(`[WS] ⏳ Throttling reconnect, wait ${Math.floor(waitTime/1000)}s`);
    return { success: false, message: `Throttled, retry in ${Math.floor(waitTime/1000)}s` };
  }

  // MAX RECONNECT ATTEMPTS GUARD
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`[WS] ❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
    return { success: false, message: "Max reconnect attempts reached" };
  }

  isConnecting = true;
  lastReconnectTime = now;
  reconnectAttempts++;

  try {
    console.log(`[WS] 🔌 Connecting to Angel WebSocket (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    wsInstance = new SmartAPI({
      api_key: apiKey,
      access_token: jwtToken
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        isConnecting = false;
        reject(new Error("WebSocket connection timeout (30s)"));
      }, 30000);

      wsInstance.connectWebSocket({
        token: feedToken,
        clientCode: clientCode
      }, (data) => {
        // MESSAGE HANDLER
        handleWebSocketMessage(data);
      });

      // CONNECTION EVENT
      wsInstance.on("connect", () => {
        clearTimeout(timeoutId);
        isConnecting = false;
        isConnected = true;
        reconnectAttempts = 0; // Reset on successful connect
        
        wsStatus.connected = true;
        wsStatus.reconnectAttempts = 0;

        console.log("[WS] ✅ CONNECTED");

        // Start heartbeat
        startHeartbeat();

        resolve({ success: true, message: "WebSocket connected" });
      });

      // ERROR EVENT
      wsInstance.on("error", (error) => {
        clearTimeout(timeoutId);
        isConnecting = false;
        isConnected = false;
        
        wsStatus.connected = false;
        wsStatus.lastError = error.message;

        console.error("[WS] ❌ Error:", error.message);

        // Check for rate limit (429)
        if (error.message.includes("429") || error.message.includes("Too Many Requests")) {
          console.error("[WS] 🚨 RATE LIMIT HIT (429) - Exponential backoff applied");
          
          // Exponential backoff for rate limits
          const backoffTime = RECONNECT_THROTTLE_MS * Math.pow(2, reconnectAttempts - 1);
          console.log(`[WS] Waiting ${Math.floor(backoffTime/1000)}s before retry`);
          
          scheduleReconnect(backoffTime);
        }

        reject(error);
      });

      // CLOSE EVENT
      wsInstance.on("close", () => {
        clearTimeout(timeoutId);
        isConnecting = false;
        isConnected = false;
        
        wsStatus.connected = false;

        console.log("[WS] ❌ DISCONNECTED");

        stopHeartbeat();

        // Auto-reconnect with throttle
        scheduleReconnect(RECONNECT_THROTTLE_MS);
      });
    });

  } catch (error) {
    isConnecting = false;
    isConnected = false;
    
    console.error("[WS] ❌ Connection failed:", error.message);
    
    return { success: false, error: error.message };
  }
}

// ==========================================
// SCHEDULE RECONNECT WITH THROTTLE
// ==========================================
function scheduleReconnect(delay) {
  // Clear existing timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Don't reconnect if max attempts reached
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("[WS] ⚠️ Not scheduling reconnect - max attempts reached");
    return;
  }

  console.log(`[WS] 🔄 Scheduling reconnect in ${Math.floor(delay/1000)}s`);

  reconnectTimer = setTimeout(() => {
    if (global.angelSession) {
      console.log("[WS] Attempting reconnect...");
      connectWebSocket(
        global.angelSession.jwtToken,
        global.angelSession.apiKey,
        global.angelSession.clientCode,
        global.angelSession.feedToken
      ).catch(err => {
        console.error("[WS] Reconnect failed:", err.message);
      });
    }
  }, delay);
}

// ==========================================
// HEARTBEAT TO KEEP CONNECTION ALIVE
// ==========================================
function startHeartbeat() {
  stopHeartbeat();
  
  heartbeatTimer = setInterval(() => {
    if (isConnected && wsInstance) {
      // Check if connection is stale
      const now = Date.now();
      const lastTickTime = wsStatus.lastTick ? new Date(wsStatus.lastTick).getTime() : 0;
      const timeSinceLastTick = now - lastTickTime;

      // If no ticks for 2 minutes, consider stale
      if (timeSinceLastTick > 120000 && wsStatus.tickCount > 0) {
        console.log("[WS] ⚠️ Connection appears stale, reconnecting...");
        disconnectWebSocket();
        scheduleReconnect(5000);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ==========================================
// HANDLE WEBSOCKET MESSAGES
// ==========================================
function handleWebSocketMessage(data) {
  try {
    wsStatus.lastTick = new Date().toISOString();
    wsStatus.tickCount++;

    // Store in global cache
    if (!global.latestOHLC) {
      global.latestOHLC = {};
    }

    if (data && data.token) {
      const subscription = activeSubscriptions.get(data.token);
      
      if (subscription) {
        global.latestOHLC[subscription.symbol] = {
          ltp: data.last_traded_price,
          open: data.open_price_day,
          high: data.high_price_day,
          low: data.low_price_day,
          close: data.close_price,
          volume: data.volume_trade_for_day,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Emit event for listeners
    wsEmitter.emit("tick", data);

  } catch (error) {
    console.error("[WS] Message handler error:", error.message);
  }
}

// ==========================================
// SUBSCRIBE TO TOKENS (WITH LIMIT CHECK)
// ==========================================
function subscribeTokens(tokens, source = "manual") {
  if (!isConnected || !wsInstance) {
    console.log(`[WS] ⚠️ Not connected, cannot subscribe (source: ${source})`);
    return false;
  }

  // Check subscription limit
  const newCount = totalSubscriptionCount + tokens.length;
  if (newCount > MAX_SUBSCRIPTIONS_PER_CONNECTION) {
    console.log(`[WS] ❌ Subscription limit exceeded: ${newCount}/${MAX_SUBSCRIPTIONS_PER_CONNECTION}`);
    return false;
  }

  try {
    console.log(`[WS] 📥 Subscribing ${tokens.length} tokens (source: ${source})`);

    const subscriptionData = tokens.map(t => ({
      exchangeType: t.exchangeType || 1,
      tokens: [t.token],
      mode: t.mode || 3 // FULL mode
    }));

    wsInstance.subscribe(subscriptionData);

    // Track subscriptions
    tokens.forEach(t => {
      activeSubscriptions.set(t.token, {
        symbol: t.symbol,
        exchangeType: t.exchangeType || 1,
        mode: t.mode || 3,
        subscribedAt: Date.now(),
        source
      });
      totalSubscriptionCount++;
    });

    wsStatus.subscriptionCount = totalSubscriptionCount;

    console.log(`[WS] ✅ Subscribed. Total: ${totalSubscriptionCount}/${MAX_SUBSCRIPTIONS_PER_CONNECTION}`);

    return true;

  } catch (error) {
    console.error(`[WS] ❌ Subscribe error (source: ${source}):`, error.message);
    return false;
  }
}

// ==========================================
// UNSUBSCRIBE FROM TOKENS
// ==========================================
function unsubscribeTokens(tokens, source = "manual") {
  if (!isConnected || !wsInstance) {
    console.log(`[WS] ⚠️ Not connected, cannot unsubscribe (source: ${source})`);
    return false;
  }

  try {
    console.log(`[WS] 📤 Unsubscribing ${tokens.length} tokens (source: ${source})`);

    const unsubscriptionData = tokens.map(t => ({
      exchangeType: t.exchangeType || 1,
      tokens: [t.token]
    }));

    wsInstance.unsubscribe(unsubscriptionData);

    // Remove from tracking
    tokens.forEach(t => {
      const token = typeof t === "string" ? t : t.token;
      activeSubscriptions.delete(token);
      totalSubscriptionCount--;
    });

    wsStatus.subscriptionCount = totalSubscriptionCount;

    console.log(`[WS] ✅ Unsubscribed. Total: ${totalSubscriptionCount}/${MAX_SUBSCRIPTIONS_PER_CONNECTION}`);

    return true;

  } catch (error) {
    console.error(`[WS] ❌ Unsubscribe error (source: ${source}):`, error.message);
    return false;
  }
}

// ==========================================
// DISCONNECT WEBSOCKET
// ==========================================
function disconnectWebSocket() {
  console.log("[WS] 🛑 Disconnecting WebSocket...");

  stopHeartbeat();

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (wsInstance) {
    try {
      wsInstance.disconnect();
    } catch (error) {
      console.error("[WS] Disconnect error:", error.message);
    }
    wsInstance = null;
  }

  isConnecting = false;
  isConnected = false;
  wsStatus.connected = false;

  console.log("[WS] Disconnected");
}

// ==========================================
// GET WEBSOCKET STATUS
// ==========================================
function getWebSocketStatus() {
  const now = Date.now();
  const lastTickTime = wsStatus.lastTick ? new Date(wsStatus.lastTick).getTime() : 0;
  const lastTickAge = now - lastTickTime;

  return {
    connected: isConnected,
    connecting: isConnecting,
    lastTick: wsStatus.lastTick,
    lastTickAge: Math.floor(lastTickAge / 1000),
    tickCount: wsStatus.tickCount,
    subscriptionCount: totalSubscriptionCount,
    maxSubscriptions: MAX_SUBSCRIPTIONS_PER_CONNECTION,
    utilization: ((totalSubscriptionCount / MAX_SUBSCRIPTIONS_PER_CONNECTION) * 100).toFixed(1),
    reconnectAttempts: reconnectAttempts,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    lastError: wsStatus.lastError,
    isStale: lastTickAge > 60000 && wsStatus.tickCount > 0
  };
}

// ==========================================
// GET SUBSCRIPTION COUNT
// ==========================================
function getSubscriptionCount() {
  return totalSubscriptionCount;
}

// ==========================================
// GET ACTIVE SUBSCRIPTIONS
// ==========================================
function getActiveSubscriptions() {
  return Array.from(activeSubscriptions.entries()).map(([token, data]) => ({
    token,
    symbol: data.symbol,
    source: data.source,
    age: Math.floor((Date.now() - data.subscribedAt) / 1000)
  }));
}

// ==========================================
// RESET RECONNECT ATTEMPTS (ADMIN)
// ==========================================
function resetReconnectAttempts() {
  reconnectAttempts = 0;
  wsStatus.reconnectAttempts = 0;
  console.log("[WS] ✅ Reconnect attempts reset");
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  connectWebSocket,
  disconnectWebSocket,
  subscribeTokens,
  unsubscribeTokens,
  getWebSocketStatus,
  getSubscriptionCount,
  getActiveSubscriptions,
  resetReconnectAttempts,
  wsEmitter,
  MAX_SUBSCRIPTIONS_PER_CONNECTION
};
