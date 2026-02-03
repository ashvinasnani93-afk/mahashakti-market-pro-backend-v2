// ==========================================
// ANGEL ONE WEBSOCKET SERVICE
// Real-Time Market Data Feed
// FIXED VERSION - Binary Decode Fix
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
// ==========================================
// ADD: FULL / SNAPQUOTE PACKETS (OHLC SUPPORT)
// ==========================================
else if (Buffer.isBuffer(data) && data.length >= 90) {
const ohlc = decodeBinaryFULL(data);
if (ohlc && ohlc.token) {
updateOHLC(ohlc);
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
// DECODE BINARY LTP (Angel Format) - FIXED
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
// ADD: DECODE FULL / SNAPQUOTE (OHLC + VOLUME)
// ==========================================
function decodeBinaryFULL(buffer) {
try {
const tokenStr = buffer
  .toString("utf8", 2, 27)
  .replace(/\0/g, "")
  .trim();

// Empirical Angel FULL frame offsets
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

// Initialize open price  
if (!global.symbolOpenPrice[token]) {  
  global.symbolOpenPrice[token] = Number(price);  
}

} catch (err) {
console.error("❌ Update LTP Error:", err.message);
}
}

// ==========================================
// ADD: UPDATE OHLC IN GLOBAL CACHE
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

// Mirror LTP also
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
// SUBSCRIBE TO ADDITIONAL TOKEN (LTP MODE)
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
// ADD: SUBSCRIBE FULL MODE (OHLC SUPPORT)
// ==========================================
function subscribeFullToken(token, exchangeType = 5) {
try {
if (!ws || ws.readyState !== WebSocket.OPEN) return false;

const payload = {
  action: "subscribe",
  mode: "FULL",
  exchangeType: exchangeType, // 5 = MCX, 1 = NSE
  tokens: [String(token)]
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
// EXPORTS
// ==========================================
module.exports = {
startAngelWebSocket,
subscribeToToken,
subscribeFullToken,
setClientCode,
setSessionTokens
};
