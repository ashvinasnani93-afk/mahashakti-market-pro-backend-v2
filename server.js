// ==========================================
// MAHASHAKTI MARKET PRO
// FINAL – ALL STOCKS + OPTIONS LTP (AUDITED + ENGINE LINKED)
// ==========================================

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

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

const tokenService = require("./token.service");
const { loadOptionSymbolMaster, initializeTokenService } = tokenService;
const { setAllSymbols } = require("./symbol.service");
const { setSmartApi } = require("./services/angel/angelTokens");

const {
  startAngelEngine,
  isSystemReady,
  isWsConnected,
  setSymbolMaster   // 🔥 MISSING IMPORT
} = require("./src.angelEngine.js");

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


let isLoggingIn = false;

let symbolTokenMap = {};
let tokenSymbolMap = {};


const latestLTP = {};
global.latestLTP = latestLTP;
global.subscribeSymbol = null;
global.symbolOpenPrice = {};

// Runtime flags

let angelLoggedIn = false;

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
// ANGEL LOGIN
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

// 🔥 EXPORT TOKENS TO ENV FOR ALL SERVICES
process.env.ANGEL_ACCESS_TOKEN = session.data.jwtToken;
process.env.ANGEL_FEED_TOKEN = session.data.feedToken;   // ← ADD THIS LINE

    angelLoggedIn = true;
    console.log("✅ Angel Login SUCCESS");

    // 🔥 LINK SMARTAPI TO TOKEN SERVICE (Carry-2B FIX)
    setSmartApi(smartApi);

   
  } catch (e) {
    angelLoggedIn = false;
    console.error("❌ Angel Login Error:", e.message);
    setTimeout(angelLogin, 5000);
  } finally {
    isLoggingIn = false;
  }
}

// ==========================================
// SMARTAPI DIRECT LTP FETCH
// ==========================================
async function getSmartApiLTP(exchange, symbol, token) {
  if (!smartApi) {
    throw new Error("SmartAPI not initialized");
  }

  try {
    const res = await smartApi.getLTP(exchange, symbol, token);
    return res?.data?.ltp || null;
  } catch (e) {
    console.error("❌ SmartAPI LTP Error:", e.message);
    return null;
  }
}

// ==========================================
// LTP API
// ==========================================
app.get("/angel/ltp", async (req, res) => {
  try {
    const { exchange, symbol, token } = req.query;

    if (!exchange || !symbol || !token) {
      return res.status(400).json({
        status: false,
        message: "exchange, symbol, token required"
      });
    }

    const ltp = await getSmartApiLTP(exchange, symbol, token);

    if (!ltp) {
      return res.status(503).json({
        status: false,
        message: "LTP unavailable"
      });
    }

    res.json({
      status: true,
      exchange,
      symbol,
      ltp
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      error: e.message
    });
  }
});

// ==========================================
// OPTION CHAIN
// ==========================================
app.use("/angel/option-chain", optionChainRoutes);

// ==========================================
// LOGIN LOOP
// ==========================================
function startAngelLoginLoop() {
  setTimeout(angelLogin, 2000);

  setInterval(() => {
    if (!feedToken && !isLoggingIn) {
      console.log("🔁 Retrying Angel login...");
      angelLogin();
    }
  }, 60000);
}

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);

  try {
   await initializeTokenService();

await loadSymbolMaster();

// LINK STOCK SYMBOLS INTO ENGINE
setAllSymbols(Object.keys(symbolTokenMap));

// LOAD OPTIONS
await loadOptionSymbolMaster();

// 🔥🔥 THIS LINE IS MISSING — ENGINE NEVER GETS OPTIONS
global.OPTION_SYMBOLS = require("./token.service").getLoadedCount
  ? require("./token.service")
  : null;

// OR BETTER (CLEAN WAY)
global.OPTION_SYMBOLS = tokenService.getAllOptionMaster();

// 🔥 INJECT INTO ENGINE
setSymbolMaster(global.OPTION_SYMBOLS);

startAngelLoginLoop();

    // 🔥 START LIVE ENGINE AFTER SYMBOLS READY
    setTimeout(() => {
      console.log("🧠 Booting Angel LIVE Engine...");
      startAngelEngine();
    }, 5000);

  } catch (e) {
    console.error("❌ Startup failed:", e);
  }
});

// ==========================================
// SAFE SHUTDOWN
// ==========================================
function gracefulShutdown(signal) {
  console.log(`🛑 ${signal} received. Shutting down safely...`);

 

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
