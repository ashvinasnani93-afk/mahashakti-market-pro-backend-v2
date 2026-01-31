// ==========================================
// MAHASHAKTI MARKET PRO — ENTERPRISE SERVER
// CARRY-1 FINAL
// SINGLE SOURCE OF TRUTH:
//   - WS + LTP BUS = src.angelEngine.js
//   - server.js = LOGIN + SYMBOL MASTER + API LAYER
// ==========================================

"use strict";

const express = require("express");
const cors = require("cors");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

// ==========================================
// ROUTES / APIS
// ==========================================
const signalRoutes = require("./routes/signal.routes");
const { getSignal } = require("./signal.api");
const optionChainRoutes = require("./optionchain.api");

const { getIndexConfigAPI } = require("./services/index.api");
const { getCommodity } = require("./services/commodity.api");

const momentumScannerApi = require("./services/momentumScanner.api");
const institutionalFlowApi = require("./services/institutionalFlow.api");
const sectorParticipationApi = require("./services/sectorParticipation.api");

const batchSignalsApi = require("./services/signals.batch.api");
const moversApi = require("./services/scanner/movers.api");

// ==========================================
// TOKEN / ENGINE
// ==========================================
const tokenService = require("./token.service");
const {
  initializeTokenService,
  loadOptionMaster,
  loadOptionSymbolMaster,
  getAllOptionMaster
} = tokenService;

const { setAllSymbols, setOptionSymbolMaster } = require("./symbol.service");
const { setSmartApi } = require("./services/angel/angelTokens");

const {
  startAngelEngine,
  isSystemReady,
  isWsConnected,
  setSymbolMaster
} = require("./src.angelEngine");

// ==========================================
// APP BOOT
// ==========================================
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ==========================================
// BASIC ROUTES
// ==========================================
app.get("/", (req, res) => {
  res.send("Mahashakti Market Pro API is LIVE 🚀 (ENTERPRISE MODE)");
});

// ==========================================
// SYSTEM STATUS
// ==========================================
app.get("/api/status", (req, res) => {
  try {
    return res.json({
      status: true,
      ready: isSystemReady(),
      ws: isWsConnected(),
      mode: "ENTERPRISE",
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
// ROUTE WIRING
// ==========================================
app.use("/api", signalRoutes);

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

// OPTION CHAIN
app.use("/angel/option-chain", optionChainRoutes);

// ==========================================
// ENV CHECK
// ==========================================
const {
  ANGEL_API_KEY,
  ANGEL_CLIENT_ID,
  ANGEL_PASSWORD,
  ANGEL_TOTP_SECRET,
  PORT
} = process.env;

if (!ANGEL_API_KEY) throw new Error("ANGEL_API_KEY missing");
if (!ANGEL_CLIENT_ID) throw new Error("ANGEL_CLIENT_ID missing");
if (!ANGEL_PASSWORD) throw new Error("ANGEL_PASSWORD missing");
if (!ANGEL_TOTP_SECRET) throw new Error("ANGEL_TOTP_SECRET missing");

// ==========================================
// GLOBAL STATE
// ==========================================
let smartApi = null;
let isLoggingIn = false;
let angelLoggedIn = false;

let feedToken = null;
let jwtToken = null;
let refreshToken = null;

// Global LTP bus (engine writes, API reads)
if (!global.latestLTP) {
  global.latestLTP = {};
}

// ==========================================
// RATE LIMIT
// ==========================================
const rateLimitMap = {};

function checkRateLimit(req, limit = 240, windowMs = 60000) {
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
// SYMBOL MASTER (ALL SEGMENTS)
// ==========================================
let symbolTokenMap = {};

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
            try {
              const json = JSON.parse(data);

              json.forEach((item) => {
                if (!item.symbol || !item.token) return;

                const exch = (item.exch_seg || item.exchSeg || "").toUpperCase();
                let exchangeType = null;

                // Angel official mapping
                if (exch === "NSE") exchangeType = 1; // NSE CM
                if (exch === "BSE") exchangeType = 3; // BSE CM
                if (exch === "NFO") exchangeType = 2; // NSE FO
                if (exch === "MCX") exchangeType = 5; // MCX FO

                if (!exchangeType) return;

                const symbol = item.symbol.toUpperCase();

                symbolTokenMap[symbol] = {
                  token: String(item.token),
                  exchangeType,
                  symbol
                };
              });

              console.log(
                "✅ SYMBOLS Loaded:",
                Object.keys(symbolTokenMap).length
              );
              resolve();
            } catch (e) {
              reject(e);
            }
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

    jwtToken = session?.data?.jwtToken || null;
    refreshToken = session?.data?.refreshToken || null;
    feedToken = session?.data?.feedToken || null;

    if (!jwtToken || !feedToken) {
      throw new Error("Invalid token response from Angel");
    }

    smartApi.setAccessToken(jwtToken);

    // Export for engine
    process.env.ANGEL_ACCESS_TOKEN = jwtToken;
    process.env.ANGEL_FEED_TOKEN = feedToken;

    angelLoggedIn = true;
    console.log("✅ Angel Login SUCCESS");

    // Link SmartAPI to services
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
// LTP API (ENTERPRISE — WS BUS ONLY)
// ==========================================
app.get("/angel/ltp", async (req, res) => {
  try {
    if (!checkRateLimit(req, 240, 60000)) {
      return res.status(429).json({
        status: false,
        message: "Rate limit exceeded"
      });
    }

    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        status: false,
        message: "token required"
      });
    }

    const data = global.latestLTP[String(token)];

    if (!data) {
      return res.status(503).json({
        status: false,
        message: "LTP not in stream yet"
      });
    }

    return res.json({
      status: true,
      source: "ws",
      token: data.token,
      exchangeType: data.exchangeType,
      symbol: data.symbol,
      ltp: data.ltp,
      time: data.time
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      error: e.message
    });
  }
});

// ==========================================
// LOGIN LOOP
// ==========================================
function startAngelLoginLoop() {
  setTimeout(angelLogin, 2000);

  setInterval(() => {
    if (!angelLoggedIn && !isLoggingIn) {
      console.log("🔁 Retrying Angel login...");
      angelLogin();
    }
  }, 60000);
}

// ==========================================
// SERVER START
// ==========================================
const SERVER_PORT = PORT || 3000;

app.listen(SERVER_PORT, async () => {
  console.log("🚀 Server running on port", SERVER_PORT);

  try {
    // Token Service baseline
    await initializeTokenService();

    // Load Symbols (ALL segments)
    await loadSymbolMaster();

    // Register stock / FO / commodity tokens
    setAllSymbols(Object.values(symbolTokenMap));

    // Load Option Master (42K+)
    if (loadOptionMaster) {
      await loadOptionMaster(true);
    } else {
      await loadOptionSymbolMaster();
    }

    const optionMaster = getAllOptionMaster
      ? getAllOptionMaster()
      : tokenService.getAllOptionMaster
      ? tokenService.getAllOptionMaster()
      : null;

    if (!optionMaster || Object.keys(optionMaster).length === 0) {
      throw new Error("Option Master empty");
    }

    // Inject option tokens into symbol service
    setOptionSymbolMaster(optionMaster);

    // Build token→meta map for engine
    const tokenMetaMap = {};

    Object.values(symbolTokenMap).forEach((s) => {
      tokenMetaMap[String(s.token)] = {
        exchangeType: s.exchangeType,
        symbol: s.symbol
      };
    });

    // Option master entries (merge)
    Object.values(optionMaster).forEach((o) => {
      if (!o || !o.token) return;
      tokenMetaMap[String(o.token)] = {
        exchangeType: o.exchangeType || 2,
        symbol: o.symbol || ""
      };
    });

    // Inject into engine
    setSymbolMaster(tokenMetaMap);

    // Start Login Loop
    startAngelLoginLoop();

    // Boot WS Engine after infra ready
    setTimeout(() => {
      console.log("🧠 Booting Angel LIVE Engine...");
      startAngelEngine();
    }, 8000);
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
