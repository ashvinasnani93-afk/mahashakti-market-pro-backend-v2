// ==========================================
// ANGEL LIVE DATA ENGINE — ENTERPRISE GRADE
// MAHASHAKTI MARKET PRO
// WS 2.0 | SEGMENTED SYMBOL MODEL
// STOCKS | INDEX | COMMODITIES | OPTIONS
// HEARTBEAT | RECONNECT | GROUPED SUBSCRIBE
// ==========================================

"use strict";

const WebSocket = require("ws");
const { fetchOptionTokens } = require("./services/angel/angelTokens");
const { getAllSymbols } = require("./symbol.service");

// ==========================================
// ENGINE STATE
// ==========================================
let ws = null;
let wsConnected = false;
let systemReady = false;
let engineRunning = false;
let heartbeatTimer = null;
let reconnectTimer = null;

// token -> { exchangeType, symbol, segment }
let SYMBOL_MASTER = {};

// ==========================================
// GLOBAL LTP BUS
// ==========================================
if (!global.latestLTP) global.latestLTP = {};

// ==========================================
// SEGMENT STORES (SEPARATED LOGIC)
// ==========================================
let STOCK_SYMBOLS = [];
let INDEX_SYMBOLS = [];
let COMMODITY_SYMBOLS = [];
let OPTION_SYMBOLS = [];

// ==========================================
// SYMBOL MASTER LINK
// ==========================================
function setSymbolMaster(map) {
  if (!map || typeof map !== "object") return;

  SYMBOL_MASTER = map;

  // RESET SEGMENTS
  STOCK_SYMBOLS = [];
  INDEX_SYMBOLS = [];
  COMMODITY_SYMBOLS = [];
  OPTION_SYMBOLS = [];

  for (const token of Object.keys(map)) {
    const meta = map[token];
    if (!meta || meta.exchangeType === undefined) continue;

    const entry = {
      token: String(token),
      exchangeType: Number(meta.exchangeType),
      symbol: meta.symbol || "",
      segment: meta.segment || detectSegment(meta)
    };

    if (entry.segment === "STOCK") STOCK_SYMBOLS.push(entry);
    else if (entry.segment === "INDEX") INDEX_SYMBOLS.push(entry);
    else if (entry.segment === "COMMODITY") COMMODITY_SYMBOLS.push(entry);
    else OPTION_SYMBOLS.push(entry);
  }

  console.log("🧠 ENGINE: Symbol Master Linked");
  console.log("  📈 STOCKS     :", STOCK_SYMBOLS.length);
  console.log("  📊 INDEX      :", INDEX_SYMBOLS.length);
  console.log("  🛢️ COMMODITY :", COMMODITY_SYMBOLS.length);
  console.log("  🧩 OPTIONS    :", OPTION_SYMBOLS.length);
}

// ==========================================
// SEGMENT DETECTOR (AUTO SAFETY)
// ==========================================
function detectSegment(meta) {
  const ex = Number(meta.exchangeType);

  if (ex === 1 || ex === 3) return "STOCK";      // NSE / BSE CM
  if (ex === 5) return "COMMODITY";              // MCX
  if (ex === 2 && meta.symbol?.includes("NIFTY")) return "INDEX"; // Index FO
  if (ex === 2) return "OPTION";                 // FO default

  return "OPTION";
}

// ==========================================
// LTP UPDATE BUS
// ==========================================
function updateLtp(token, exchangeType, ltp) {
  const meta = SYMBOL_MASTER[token] || {};

  global.latestLTP[token] = {
    token,
    exchangeType,
    symbol: meta.symbol || "",
    segment: meta.segment || detectSegment(meta),
    ltp,
    time: Date.now()
  };
}

// ==========================================
// BINARY DECODER (ANGEL WS 2.0)
// ==========================================
function decodeBinaryTick(buffer) {
  try {
    const buf = Buffer.from(buffer);

    const exchangeType = buf.readUInt16BE(0);
    const token = String(buf.readUInt32BE(2));
    const ltp = buf.readDoubleBE(6);

    if (!token || !ltp) return null;
    return { exchangeType, token, ltp };
  } catch {
    return null;
  }
}

// ==========================================
// HEARTBEAT
// ==========================================
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && wsConnected) {
      try {
        ws.send(JSON.stringify({ action: "ping" }));
      } catch {}
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// ==========================================
// ENTERPRISE GROUPED SUBSCRIBE
// STOCK | INDEX | COMMODITY | OPTION
// ==========================================
function subscribeTokensBySegment() {
  if (!ws || !wsConnected) return;

  const ALL = [
    { name: "STOCK", list: STOCK_SYMBOLS },
    { name: "INDEX", list: INDEX_SYMBOLS },
    { name: "COMMODITY", list: COMMODITY_SYMBOLS },
    { name: "OPTION", list: OPTION_SYMBOLS }
  ];

  const CHUNK = 1000;

  for (const group of ALL) {
    if (!group.list.length) continue;

    const groupedByEx = {};

    for (const s of group.list) {
      if (!groupedByEx[s.exchangeType]) {
        groupedByEx[s.exchangeType] = [];
      }
      groupedByEx[s.exchangeType].push(String(s.token));
    }

    for (const exchangeType of Object.keys(groupedByEx)) {
      const tokens = groupedByEx[exchangeType];

      for (let i = 0; i < tokens.length; i += CHUNK) {
        const batch = tokens.slice(i, i + CHUNK);

        const payload = {
          action: "subscribe",
          params: {
            mode: "LTP",
            tokenList: [
              {
                exchangeType: Number(exchangeType),
                tokens: batch
              }
            ]
          }
        };

        try {
          ws.send(JSON.stringify(payload));
        } catch {
          console.log(
            "⚠️ ENGINE: WS send failed",
            group.name,
            "EX:",
            exchangeType
          );
          return;
        }
      }

      console.log(
        `📡 ENGINE: ${group.name} subscribed`,
        tokens.length,
        "EX:",
        exchangeType
      );
    }
  }
}

// ==========================================
// WS CONNECT
// ==========================================
function connectWS(feedToken, clientCode) {
  console.log("🔌 ENGINE: Connecting Angel WS...");

  ws = new WebSocket(
    "wss://smartapisocket.angelone.in/smart-stream",
    {
      headers: {
        Authorization: `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
        "x-api-key": process.env.ANGEL_API_KEY,
        "x-client-code": clientCode,
        "x-feed-token": feedToken
      }
    }
  );

  ws.on("open", () => {
    wsConnected = true;
    console.log("🟢 ENGINE: WS Connected");
  });

  ws.on("message", (data) => {
    try {
      // AUTH CONFIRM
      if (typeof data === "string") {
        const msg = JSON.parse(data);

        if (msg?.status === true && msg?.type === "cn") {
          console.log("🔓 ENGINE: WS AUTH SUCCESS");
          systemReady = true;
          startHeartbeat();
          subscribeTokensBySegment();
        }
        return;
      }

      // BINARY TICK
      const tick = decodeBinaryTick(data);
      if (!tick) return;

      updateLtp(tick.token, tick.exchangeType, tick.ltp);
    } catch {}
  });

  ws.on("close", () => {
    console.log("🔴 ENGINE: WS Closed — reconnecting...");
    cleanupWS();
    reconnect(feedToken, clientCode);
  });

  ws.on("error", () => {
    cleanupWS();
    reconnect(feedToken, clientCode);
  });
}

// ==========================================
// CLEANUP / RECONNECT
// ==========================================
function cleanupWS() {
  wsConnected = false;
  systemReady = false;
  stopHeartbeat();
  try {
    if (ws) ws.close();
  } catch {}
  ws = null;
}

function reconnect(feedToken, clientCode) {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWS(feedToken, clientCode);
  }, 5000);
}

// ==========================================
// ENGINE BOOT
// ==========================================
async function startAngelEngine() {
  if (engineRunning) return;
  engineRunning = true;

  console.log("🚀 ENGINE: Booting Angel Live Engine...");

  try {
    const bundle = await fetchOptionTokens();
    if (!bundle?.feedToken || !bundle?.clientCode) {
      throw new Error("Invalid token bundle");
    }

    const symbols = getAllSymbols();
    if (!symbols.length) {
      throw new
