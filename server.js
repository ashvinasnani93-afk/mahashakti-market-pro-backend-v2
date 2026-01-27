// ==========================================
// MAHASHAKTI MARKET PRO
// FINAL – ALL STOCKS + OPTIONS LTP
// ==========================================

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

const signalRoutes = require("./routes/signal.routes");
const { getSignal } = require("./signal.api");
const { getOptionChain } = require("./optionchain.api");

// ✅ OPTIONS CONTEXT API (PHASE-3 START)
const { getOptionsContextApi } = require("./services/options/optionsContext.api");

// 🆕 OPTIONS FINAL API (PHASE-4)
const { getOptions } = require("./services/options.api");
const { getOptionExpiries } = require("./services/options.expiries");

// ✅ INDEX & COMMODITY APIs (AUDITED – JUST WIRED)
const { getIndexConfigAPI } = require("./services/index.api");
const { getCommodity } = require("./services/commodity.api");

// 🆕 MOMENTUM SCANNER API
const momentumScannerApi = require("./services/momentumScanner.api");

// 🆕 INSTITUTIONAL FLOW API (FII / DII CONTEXT)
const institutionalFlowApi = require("./services/institutionalFlow.api");

// 🆕🆕 SECTOR PARTICIPATION API (CONTEXT ONLY)
const sectorParticipationApi = require("./services/sectorParticipation.api");

// 🔥 MOVERS SCANNER API (FAST MOVERS)
const moversApi = require("./services/scanner/movers.api");

const { loadOptionSymbolMaster } = require("./token.service");

// 🔥 ANGEL ENGINE BOOT
const { startAngelEngine, isSystemReady, isWsConnected } = require("./src.angelEngine");

const app = express();
startAngelEngine();

app.use(cors());
app.use(express.json());

app.use("/api", signalRoutes);

app.get("/options/expiries", getOptionExpiries);

// ==========================================
// BASIC ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.send("Mahashakti Market Pro API is LIVE 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// 🆕 CARRY 0.5: EXTENDED HEALTH (SYSTEM AWARE)
app.get("/health/extended", (req, res) => {
  res.json({
    server: "running",
    systemReady,
    uptime: process.uptime(),

    angel: {
      loggedIn: angelLoggedIn,
      feedToken: Boolean(feedToken),
    },

    websocket: {
      connected: wsConnected,
      starting: wsStarting,
      subscribedTokens: subscribedTokens.size,
      activeSymbols: Object.keys(latestLTP).length,
    },

    timestamp: Date.now(),
  });
});
const PORT = process.env.PORT || 3000;

// ==========================================
// ENV CHECK
// ==========================================
const {
  ANGEL_API_KEY,
  ANGEL_CLIENT_ID,
  ANGEL_PASSWORD,
  ANGEL_TOTP_SECRET,
} = process.env;

if (!ANGEL_API_KEY) throw new Error("ANGEL_API_KEY missing");
if (!ANGEL_CLIENT_ID) throw new Error("ANGEL_CLIENT_ID missing");
if (!ANGEL_PASSWORD) throw new Error("ANGEL_PASSWORD missing");
if (!ANGEL_TOTP_SECRET) throw new Error("ANGEL_TOTP_SECRET missing");

// ==========================================
// CORE APIs
// ==========================================

// SIGNAL
app.post("/signal", getSignal);
app.get("/signal", getSignal); // 🔥 ye line add karo

// OPTIONS
app.post("/options/context", getOptionsContextApi);
app.post("/options", getOptions);

// INDEX CONFIG
app.post("/index/config", getIndexConfigAPI);

// COMMODITY
app.post("/commodity", getCommodity);

// 🆕 MOMENTUM SCANNER (NO SIGNAL)
app.use("/scanner", momentumScannerApi);

// 🔥 MOVERS SCANNER (15-20% FAST MOVERS)
app.use("/scanner", moversApi);

// 🆕 INSTITUTIONAL FLOW (CONTEXT ONLY)
app.use("/institutional", institutionalFlowApi);

// 🆕🆕 SECTOR PARTICIPATION (CONTEXT ONLY)
app.use("/sector", sectorParticipationApi);

// ==========================================
// GLOBAL STATE (CARRY 0.4 – SAFE & SINGLE)
// ==========================================

let smartApi;
let ws;
let feedToken = null;
let isLoggingIn = false;

// ---- market state ----
let symbolTokenMap = {};
let tokenSymbolMap = {};
let subscribedTokens = new Set();
let latestLTP = {};
let symbolLastSeen = {}; // SINGLE SOURCE (locked)

// 🔒 RATE LIMIT STATE (Carry-6.1)
const rateLimitMap = {};

// ---- runtime flags (Carry 0.4 hardened) ----
let wsConnected = false;
let angelLoggedIn = false;
// ==========================================
// 🆕 CARRY 0.5 — RUNTIME CONTROLLER
// ==========================================

let systemReady = false;
let wsStarting = false;

function markSystemReady() {
  systemReady = true;
  console.log("🧠 SYSTEM STATE: READY");
}
function markSystemDown(reason) {
  systemReady = false;
  console.log("🛑 SYSTEM STATE: DOWN →", reason);
}
// ==========================================
// 🆕 RATE LIMIT CHECK (Carry-6.1)
// ==========================================

function checkRateLimit(req, limit = 20, windowMs = 60 * 1000) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = {
      count: 1,
      lastReset: now,
    };
    return true;
  }

  const entry = rateLimitMap[ip];

  // Reset window
  if (now - entry.lastReset > windowMs) {
    entry.count = 1;
    entry.lastReset = now;
    return true;
  }

  // Increment count
  entry.count += 1;

  if (entry.count > limit) {
    return false;
  }

  return true;
}
// ==========================================
// LTP DECODER
// ==========================================
function decodeLTP(buffer) {
  if (buffer.length !== 51) return null;
  const pricePaise = buffer.readInt32LE(43);
  return pricePaise / 100;
}

// ==========================================
// LOAD STOCK SYMBOL MASTER
// ==========================================
function loadSymbolMaster() {
  return new Promise((resolve, reject) => {
    console.log("📥 Loading Angel Symbol Master...");

    https
      .get(
        "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            const json = JSON.parse(data);

            json.forEach((item) => {
              if (!item.symbol || !item.token) return;
              if (item.exch_seg === "NSE" || item.exch_seg === "BSE") {
                const symbol = item.symbol.toUpperCase();
                const exchangeType = item.exch_seg === "NSE" ? 1 : 3;

                symbolTokenMap[symbol] = {
                  token: item.token,
                  exchangeType,
                };
                tokenSymbolMap[item.token] = symbol;
              }
            });

            console.log(
              "✅ STOCK Symbols Loaded:",
              Object.keys(symbolTokenMap).length
            );
            resolve();
          });
        }
      )
      .on("error", reject);
  });
}

// ==========================================
// ANGEL LOGIN (CARRY 0.5 SYNCED)
// ==========================================
async function angelLogin() {
  if (isLoggingIn) return;
  isLoggingIn = true;

  try {
    console.log("🔐 Angel Login Start");

    smartApi = new SmartAPI({ api_key: ANGEL_API_KEY });
    const otp = authenticator.generate(ANGEL_TOTP_SECRET);

    const session = await smartApi.generateSession(
      ANGEL_CLIENT_ID,
      ANGEL_PASSWORD,
      otp
    );

    smartApi.setAccessToken(session.data.jwtToken);
    feedToken = session.data.feedToken;

    angelLoggedIn = true;
    console.log("✅ Angel Login SUCCESS");

    // 🆕 CARRY 0.5: start WS only once
    if (!wsConnected && !wsStarting) {
      startWebSocket();
    }

    markSystemReady();
  } catch (e) {
    angelLoggedIn = false;
    markSystemDown("ANGEL_LOGIN_FAILED");
    console.error("❌ Angel Login Error:", e);
    setTimeout(angelLogin, 5000);
  } finally {
    isLoggingIn = false;
  }
}

// ==========================================
// WEBSOCKET (CARRY 0.5 SYNCED)
// ==========================================
function startWebSocket() {
  if (!feedToken || wsConnected || wsStarting) return;

  wsStarting = true;

  const wsUrl =
    `wss://smartapisocket.angelone.in/smart-stream` +
    `?clientCode=${ANGEL_CLIENT_ID}` +
    `&feedToken=${feedToken}` +
    `&apiKey=${ANGEL_API_KEY}`;

  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log("🟢 WebSocket Connected");
    wsConnected = true;
    wsStarting = false;

    subscribedTokens.clear();
    resubscribeAllSymbols();
  });

  ws.on("message", (data) => {
    if (!Buffer.isBuffer(data)) return;
    if (data.length !== 51) return;

    const ltp = decodeLTP(data);
    const token = data.toString("utf8", 2, 27).replace(/\0/g, "");
    const symbol = tokenSymbolMap[token];

    if (symbol && ltp) {
      latestLTP[symbol] = ltp;
      symbolLastSeen[symbol] = Date.now();
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
    wsConnected = false;
    wsStarting = false;
    markSystemDown("WS_ERROR");
  });

ws.on("close", () => {
  console.log("🔴 WebSocket Disconnected");

  wsConnected = false;
  wsStarting = false;
  markSystemDown("WS_CLOSED");

  // 🔥 Force relogin to refresh feedToken
  angelLoggedIn = false;
  feedToken = null;

  setTimeout(() => {
    console.log("🔄 Re-login + WebSocket restart...");
    angelLogin();
  }, 5000);
}); 
}

// ==========================================
// 🆕 ADD: RESUBSCRIBE ALL SYMBOLS (AUDIT CARRY)
// ==========================================
function resubscribeAllSymbols() {
  if (!ws || ws.readyState !== 1) return;

  Object.keys(latestLTP).forEach((symbol) => {
    subscribeSymbol(symbol);
  });
}

// ==========================================
// SUBSCRIBE SYMBOL
// ==========================================
function subscribeSymbol(symbol) {
  const info = symbolTokenMap[symbol];
  if (!info || !ws || ws.readyState !== 1) return;
  if (subscribedTokens.has(info.token)) return;

  ws.send(
    JSON.stringify({
      action: 1,
      params: {
        mode: 1,
        tokenList: [{ exchangeType: info.exchangeType, tokens: [info.token] }],
      },
    })
  );

  subscribedTokens.add(info.token);
}

global.subscribeSymbol = subscribeSymbol; // 🔥

// ==========================================
// 🆕 ADD: IDLE SYMBOL CLEANUP (AUDIT CARRY)
// ==========================================
setInterval(() => {
  const now = Date.now();
  const MAX_IDLE_TIME = 2 * 60 * 1000; // 2 minutes

  Object.keys(symbolLastSeen).forEach((symbol) => {
    if (now - symbolLastSeen[symbol] > MAX_IDLE_TIME) {
      const info = symbolTokenMap[symbol];
      if (info) subscribedTokens.delete(info.token);

      delete latestLTP[symbol];
      delete symbolLastSeen[symbol];

      console.log("🧹 Removed inactive symbol:", symbol);
    }
  });
}, 120000);

// ==========================================
// STOCK LTP API
// ==========================================
app.get("/angel/ltp", (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  if (!symbol || !symbolTokenMap[symbol]) {
    return res.json({ status: false, message: "symbol invalid" });
  }

  subscribeSymbol(symbol);

  if (latestLTP[symbol]) {
    return res.json({
      status: true,
      symbol,
      ltp: latestLTP[symbol],
      live: true,
    });
  }

  res.json({ status: false, message: "LTP not ready yet" });
});

// ==========================================
// OPTION CHAIN API
// ==========================================
app.get("/option-chain", getOptionChain);

// ==========================================
// 🆕 ADD: SAFE ANGEL LOGIN LOOP (AUDIT CARRY)
// ==========================================
function startAngelLoginLoop() {
  setTimeout(angelLogin, 2000);

  setInterval(() => {
    if (!feedToken) {
      console.log("🔁 Retrying Angel login...");
      angelLogin();
    }
  }, 60000);
}

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);
  try {
    await loadSymbolMaster();
    await loadOptionSymbolMaster();

    // 🆕 ADD: non-blocking login loop
    startAngelLoginLoop();
  } catch (e) {
    console.error("❌ Startup failed:", e);
    process.exit(1);
  }
});
// ==========================================
// 🆕 CARRY 0.2 — SAFE SHUTDOWN HANDLING
// ==========================================

function gracefulShutdown(signal) {
  console.log(`🛑 ${signal} received. Shutting down safely...`);

  try {
    if (ws) {
      ws.close();
      console.log("🔌 WebSocket closed");
    }
  } catch (e) {
    console.error("❌ Error closing WebSocket", e);
  }

  setTimeout(() => {
    console.log("✅ Process exited cleanly");
    process.exit(0);
  }, 1000);
}

// Render / Linux signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Unexpected crash safety
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled Rejection:", reason);
  gracefulShutdown("unhandledRejection");
});
// ==========================================
// 🆕 RATE LIMIT CLEANUP (Carry-6.1.4)
// ==========================================

setInterval(() => {
  const now = Date.now();

  for (const ip in rateLimitMap) {
    if (now - rateLimitMap[ip].lastReset > 5 * 60 * 1000) {
      delete rateLimitMap[ip];
    }
  }
}, 60 * 1000);
