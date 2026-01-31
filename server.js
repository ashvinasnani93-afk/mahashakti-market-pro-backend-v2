// ==========================================
// MAHASHAKTI MARKET PRO
// ENTERPRISE 42K+ MODE — CARRY-1
// FULL REPLACEMENT FILE (SERVER BOOT LAYER)
// ------------------------------------------
// Fixes:
// 1) AUTO-SUBSCRIBE ALL STOCK TOKENS TO WS POOL
// 2) REDIS → WS → REST LTP FALLBACK CHAIN
// 3) 42K+ OPTION MASTER WIRING KEPT INTACT
// 4) OPTIONAL MODULES (ws-pool/redis/ltp-bus) AUTO-DETECT
// ==========================================

"use strict";

const express = require("express");
const cors = require("cors");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

// ==========================================
// ROUTES / APIS (EXISTING MODULES)
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

// ==========================================
// TOKEN / ENGINE
// ==========================================
const tokenService = require("./token.service");
const {
  initializeTokenService,
  loadOptionSymbolMaster, // backward compat
  loadOptionMaster,      // new baseline
  getAllOptionMaster
} = tokenService;

const { setAllSymbols } = require("./symbol.service");
const { setSmartApi } = require("./services/angel/angelTokens");

const {
  startAngelEngine,
  isSystemReady,
  isWsConnected,
  setSymbolMaster
} = require("./src.angelEngine.js");

// ==========================================
// OPTIONAL ENTERPRISE MODULES (AUTO-DETECT)
// ==========================================
let createWsPool = null;
let redisInit = null;
let redisGet = null;
let redisSet = null;
let publishLTP = null;

try {
  ({ createWsPool } = require("./ws-pool.manager"));
  console.log("🧩 ws-pool.manager loaded");
} catch {
  console.log("⚠️ ws-pool.manager NOT FOUND → WS Pool disabled (degraded mode)");
}

try {
  ({ redisInit, redisGet, redisSet } = require("./redis.adapter"));
  console.log("🧩 redis.adapter loaded");
} catch {
  console.log("⚠️ redis.adapter NOT FOUND → Redis disabled (memory only)");
}

try {
  ({ publishLTP } = require("./ltp-bus"));
  console.log("🧩 ltp-bus loaded");
} catch {
  console.log("⚠️ ltp-bus NOT FOUND → LTP bus disabled");
}

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
  res.send("Mahashakti Market Pro API is LIVE 🚀 (ENTERPRISE 42K+ MODE)");
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
      mode: "ENTERPRISE_42K_PLUS",
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
  REDIS_URL,
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

const latestLTP = {};
global.latestLTP = latestLTP;

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
let tokenSymbolMap = {};

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
               if (exch === "NSE") exchangeType = 1;   // NSE CM
               if (exch === "BSE") exchangeType = 3;   // BSE CM
               if (exch === "NFO") exchangeType = 2;   // NSE FO (Options/Futures)
               if (exch === "MCX") exchangeType = 5;   // MCX FO

                if (!exchangeType) return;

                const symbol = item.symbol.toUpperCase();

                symbolTokenMap[symbol] = {
                  token: item.token,
                  exchangeType
                };

                tokenSymbolMap[item.token] = symbol;
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

    // Export for other services
    process.env.ANGEL_ACCESS_TOKEN = jwtToken;
    process.env.ANGEL_FEED_TOKEN = feedToken;

    angelLoggedIn = true;
    console.log("✅ Angel Login SUCCESS");

    // Link SmartAPI globally
    setSmartApi(smartApi);

    // Start WS Pool AFTER login (if available)
    await startWsPool();

  } catch (e) {
    angelLoggedIn = false;
    console.error("❌ Angel Login Error:", e.message);
    setTimeout(angelLogin, 5000);
  } finally {
    isLoggingIn = false;
  }
}

// ==========================================
// TOKEN REFRESH GUARD
// ==========================================
async function refreshJwtToken() {
  try {
    if (!refreshToken || !smartApi) return;

    console.log("🔁 Refreshing JWT Token...");
    const res = await smartApi.generateToken(refreshToken);

    jwtToken = res?.data?.jwtToken || jwtToken;
    refreshToken = res?.data?.refreshToken || refreshToken;
    feedToken = res?.data?.feedToken || feedToken;

    smartApi.setAccessToken(jwtToken);

    process.env.ANGEL_ACCESS_TOKEN = jwtToken;
    process.env.ANGEL_FEED_TOKEN = feedToken;

    console.log("✅ Token Refresh SUCCESS");
  } catch (e) {
    console.error("❌ Token Refresh Failed:", e.message);
    angelLoggedIn = false;
  }
}

// ==========================================
// WS POOL (OPTIONAL — 70 SOCKETS)
// ==========================================
let wsPool = null;

async function startWsPool() {
  if (!createWsPool || wsPool) return;

  console.log("🧩 Starting WS Pool Manager (70 sockets)...");

  wsPool = createWsPool({
    maxSockets: 70, // FULL 42K+ MODE
    tokensPerSocket: 1000,
    apiKey: ANGEL_API_KEY,
    clientCode: ANGEL_CLIENT_ID,
    getJwt: () => jwtToken,
    getFeedToken: () => feedToken,

    onTick: (tick) => {
      if (!tick || !tick.token) return;

      latestLTP[tick.token] = tick.ltp;

      if (publishLTP) {
        publishLTP(tick);
      }

      if (redisSet) {
        redisSet(`ltp:${tick.exchangeType}:${tick.token}`, tick.ltp, 5);
      }
    },

    onAuthError: async () => {
      console.log("⚠️ WS Auth Error → Refreshing token");
      await refreshJwtToken();
    }
  });

  await wsPool.start();
  console.log("✅ WS Pool ONLINE (70 sockets)");

  // 🔥 AUTO-SUBSCRIBE ALL STOCK TOKENS
  subscribeAllStocksToWS();
}

// ==========================================
// AUTO-SUBSCRIBE STOCK TOKENS
// ==========================================
function subscribeAllStocksToWS() {
  if (!wsPool || !symbolTokenMap) return;

  const tokens = Object.values(symbolTokenMap).map((s) => ({
    token: s.token,
    exchangeType: s.exchangeType
  }));

  if (!tokens.length) {
    console.log("⚠️ No stock tokens found to subscribe");
    return;
  }

  console.log("📡 Subscribing STOCK tokens to WS:", tokens.length);
  if (wsPool.subscribe) {
    wsPool.subscribe(tokens);
  }
}

// ==========================================
// SMARTAPI DIRECT LTP (FALLBACK)
// ==========================================
async function getSmartApiLTP(exchange, symbol, token) {
  try {
    // 🔥 1. WS MEMORY FIRST (FAST MODE)
    if (global.latestLTP && global.latestLTP[token]) {
      return global.latestLTP[token];
    }

    // 🔁 2. FALLBACK TO SMARTAPI REST
    if (!smartApi) {
      console.log("⚠️ LTP: SmartAPI not initialized");
      return null;
    }

    const res = await smartApi.getLTP(exchange, symbol, token);
    const ltp = res?.data?.ltp || null;

    if (ltp) {
      // Cache it
      global.latestLTP[token] = ltp;
    }

    return ltp;
  } catch (e) {
    console.error("❌ SmartAPI LTP Error:", e.message);
    return null;
  }
}
// ==========================================
// LTP API (REDIS → WS → REST)
// ==========================================
app.get("/angel/ltp", async (req, res) => {
  try {
    if (!checkRateLimit(req, 240, 60000)) {
      return res.status(429).json({
        status: false,
        message: "Rate limit exceeded"
      });
    }

  let { exchange, exchangeType, symbol, token } = req.query;
exchange = exchange || exchangeType;

    if (!exchangeType || !token) {
      return res.status(400).json({
        status: false,
        message: "exchangeType, token required"
      });
    }

    // Redis first
    if (redisGet) {
      const cached = await redisGet(`ltp:${exchangeType}:${token}`);
      if (cached) {
        return res.json({
          status: true,
          source: "redis",
          token,
          ltp: Number(cached)
        });
      }
    }

    // WS memory
    if (latestLTP[token]) {
      return res.json({
        status: true,
        source: "ws",
        token,
        ltp: latestLTP[token]
      });
    }

    // REST fallback
    if (!symbol) {
      return res.status(503).json({
        status: false,
        message: "Symbol required for REST fallback"
      });
    }

    const ltp = await getSmartApiLTP("NSE", symbol, token);

    if (!ltp) {
      return res.status(503).json({
        status: false,
        message: "LTP unavailable"
      });
    }

    res.json({
      status: true,
      source: "rest",
      token,
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
    // Redis init (optional)
    if (redisInit && REDIS_URL) {
      await redisInit(REDIS_URL);
    }

    // Token Service baseline
    await initializeTokenService();

    // Load Symbols (All segments)
    await loadSymbolMaster();
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

    // Inject into Engine
    setSymbolMaster(optionMaster);

    // Start Login Loop (WS starts after login)
    startAngelLoginLoop();

    // Start Engine after infra ready
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

  try {
    if (wsPool && wsPool.stop) wsPool.stop();
  } catch (e) {
    console.error("WS stop error:", e.message);
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
