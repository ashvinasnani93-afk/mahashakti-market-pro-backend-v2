// ==========================================
// MAHASHAKTI MARKET PRO
// FINAL – ALL STOCKS + OPTIONS LTP (AUDITED + ENGINE WIRED)
// ==========================================

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");
const { setAllSymbols } = require("./symbol.service");

// ==========================================
// ANGEL ENGINE (SINGLE SOURCE OF TRUTH)
// ==========================================
const {
  startAngelEngine,
  isSystemReady,
  isWsConnected
} = require("./src.angelEngine");

// ==========================================
// ROUTES / APIS
// ==========================================
const signalRoutes = require("./routes/signal.routes");
const { getSignal } = require("./signal.api");
const optionChainRoutes = require("./optionchain.api");

const { getOptionsContextApi } = require("./services/options/optionsContext.api");
const { getOptions } = require("./services/options.api");
const { getOptionExpiries } = require("./services/options.expiries");

const { getIndexConfigAPI } = require("./services/index.api");
const { getCommodity } = require("./services/commodity.api");

const momentumScannerApi = require("./services/momentumScanner.api");
const institutionalFlowApi = require("./services/institutionalFlow.api");
const sectorParticipationApi = require("./services/sectorParticipation.api");

const batchSignalsApi = require("./services/signals.batch.api");
const moversApi = require("./services/scanner/movers.api");

const { loadOptionSymbolMaster } = require("./token.service");

// ==========================================
// APP BOOT
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ROUTE WIRING
// ==========================================
app.use("/api", signalRoutes);
app.get("/options/expiries", getOptionExpiries);

const optionsApi = require("./services/options.api");
app.use("/options", optionsApi);

// CORE APIs
app.post("/signal", getSignal);
app.get("/signal", getSignal);

app.post("/index/config", getIndexConfigAPI);
app.post("/commodity", getCommodity);

app.use("/scanner", momentumScannerApi);
app.use("/institutional", institutionalFlowApi);
app.use("/sector", sectorParticipationApi);
app.use("/scanner", moversApi);
app.use("/signals", batchSignalsApi);

// ==========================================
// BASIC ROUTES
// ==========================================
app.get("/", (req, res) => {
  res.send("Mahashakti Market Pro API is LIVE 🚀");
});

// ==========================================
// SYSTEM STATUS (REAL ENGINE STATE)
// ==========================================
app.get("/api/status", (req, res) => {
  try {
    return res.json({
      status: true,
      ready: isSystemReady(),
      ws: isWsConnected(),
      service: "Mahashakti Market Pro",
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({
      status: false,
      ready: false,
      ws: false,
      error: e.message
    });
  }
});

// ==========================================
// HEALTH
// ==========================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ==========================================
// ENV CHECK
// ==========================================
const {
  ANGEL_API_KEY,
  ANGEL_CLIENT_ID,
  ANGEL_PASSWORD,
  ANGEL_TOTP_SECRET
} = process.env;

if (!ANGEL_API_KEY) throw new Error("ANGEL_API_KEY missing");
if (!ANGEL_CLIENT_ID) throw new Error("ANGEL_CLIENT_ID missing");
if (!ANGEL_PASSWORD) throw new Error("ANGEL_PASSWORD missing");
if (!ANGEL_TOTP_SECRET) throw new Error("ANGEL_TOTP_SECRET missing");

// ==========================================
// GLOBAL STATE (SAFE SINGLE SOURCE)
// ==========================================
let smartApi;
let ws;
let feedToken = null;
let isLoggingIn = false;

let symbolTokenMap = {};
let tokenSymbolMap = {};
let subscribedTokens = new Set();
let latestLTP = {};
let symbolLastSeen = {};

global.latestLTP = latestLTP;
global.subscribeSymbol = null;
global.symbolOpenPrice = {};

// ==========================================
// RATE LIMIT
// ==========================================
const rateLimitMap = {};

function checkRateLimit(req, limit = 20, windowMs = 60000) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = { count: 1, lastReset: now };
    return true;
  }

  const entry = rateLimitMap[ip];

  if (now - entry.lastReset > windowMs) {
    entry.count = 1;
    entry.lastReset = now;
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
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
// SYMBOL MASTER
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
                  exchangeType
                };
                tokenSymbolMap[item.token] = symbol;
              }
            });

           const symbols = Object.keys(symbolTokenMap);

console.log("✅ STOCK Symbols Loaded:", symbols.length);

// 🔥 SEND TO ANGEL ENGINE
setAllSymbols(symbols);

resolve();
          });
        }
      )
      .on("error", reject);
  });
}

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);

  try {
    await loadSymbolMaster();
    await loadOptionSymbolMaster();

    // 🔥 BOOT ANGEL ENGINE (SINGLE SOURCE)
    setTimeout(() => {
      console.log("🧠 Booting Angel LIVE Engine...");
      startAngelEngine();
    }, 5000);
  } catch (e) {
    console.error("❌ Startup failed:", e);
    process.exit(1);
  }
});

// ==========================================
// SAFE SHUTDOWN
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

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled Rejection:", reason);
  gracefulShutdown("unhandledRejection");
});

// ==========================================
// RATE LIMIT CLEANUP
// ==========================================
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimitMap) {
    if (now - rateLimitMap[ip].lastReset > 5 * 60 * 1000) {
      delete rateLimitMap[ip];
    }
  }
}, 60000);
