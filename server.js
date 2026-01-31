// ==========================================
// MAHASHAKTI MARKET PRO — ENTERPRISE SERVER
// SYMBOL → TOKEN → WS → LTP MODE (CARRY-1.5 FINAL)
// ==========================================

"use strict";

const express = require("express");
const cors = require("cors");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

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
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.send("Mahashakti Market Pro API is LIVE 🚀 (SYMBOL LTP MODE)");
});

app.get("/api/status", (req, res) => {
  res.json({
    status: true,
    ready: isSystemReady(),
    ws: isWsConnected(),
    mode: "SYMBOL_LTP_ENTERPRISE",
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// ENV
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
// GLOBAL WS BUS
// ==========================================
if (!global.latestLTP) global.latestLTP = {};

// ==========================================
// SYMBOL MASTER
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

                const exch = (item.exch_seg || "").toUpperCase();
                let exchangeType = null;

                if (exch === "NSE") exchangeType = 1;
                if (exch === "BSE") exchangeType = 3;
                if (exch === "NFO") exchangeType = 2;
                if (exch === "MCX") exchangeType = 5;

                if (!exchangeType) return;

                const symbol = item.symbol.toUpperCase();

                symbolTokenMap[symbol] = {
                  token: String(item.token),
                  exchangeType,
                  symbol
                };
              });

              console.log("✅ SYMBOLS Loaded:", Object.keys(symbolTokenMap).length);
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
let smartApi = null;
let isLoggingIn = false;
let angelLoggedIn = false;

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

    const jwtToken = session?.data?.jwtToken;
    const feedToken = session?.data?.feedToken;

    if (!jwtToken || !feedToken) {
      throw new Error("Invalid token bundle");
    }

    smartApi.setAccessToken(jwtToken);
    process.env.ANGEL_ACCESS_TOKEN = jwtToken;
    process.env.ANGEL_FEED_TOKEN = feedToken;

    angelLoggedIn = true;
    console.log("✅ Angel Login SUCCESS");

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
// RATE LIMIT (SAFE DEFAULT)
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
// LTP API — SYMBOL + TOKEN RESOLVER
// ==========================================
app.get("/angel/ltp", async (req, res) => {
  try {
    if (!checkRateLimit(req, 240, 60000)) {
      return res.status(429).json({
        status: false,
        message: "Rate limit exceeded"
      });
    }

    let { symbol, token, exchangeType } = req.query;

    // Resolve SYMBOL → TOKEN
    if (!token && symbol) {
      const key = symbol.toUpperCase();
      const meta = symbolTokenMap[key];

      if (!meta) {
        return res.status(404).json({
          status: false,
          message: "Symbol not found in master",
          symbol: key
        });
      }

      token = meta.token;
      exchangeType = meta.exchangeType;
    }

    if (!token) {
      return res.status(400).json({
        status: false,
        message: "token or symbol required"
      });
    }

    const data = global.latestLTP[String(token)];

    if (!data) {
      return res.status(503).json({
        status: false,
        message: "LTP not in stream yet",
        token,
        exchangeType
      });
    }

    return res.json({
      status: true,
      source: "ws",
      token,
      exchangeType: data.exchangeType || exchangeType,
      symbol,
      ltp: data.ltp,
      time: data.time
    });
  } catch (e) {
    return res.status(500).json({
      status: false,
      error: e.message
    });
  }
});

// ==========================================
// ROUTES
// ==========================================
app.use("/api", signalRoutes);
app.post("/signal", getSignal);
app.get("/signal", getSignal);
app.post("/index/config", getIndexConfigAPI);
app.post("/commodity", getCommodity);

app.use("/scanner", momentumScannerApi);
app.use("/institutional", institutionalFlowApi);
app.use("/sector", sectorParticipationApi);
app.use("/scanner", moversApi);
app.use("/signals", batchSignalsApi);
app.use("/angel/option-chain", optionChainRoutes);

// ==========================================
// START
// ==========================================
const SERVER_PORT = PORT || 3000;

app.listen(SERVER_PORT, async () => {
  console.log("🚀 Server running on", SERVER_PORT);

  try {
    await initializeTokenService();
    await loadSymbolMaster();

    setAllSymbols(Object.values(symbolTokenMap));

    if (loadOptionMaster) {
      await loadOptionMaster(true);
    } else {
      await loadOptionSymbolMaster();
    }

    const optionMaster = getAllOptionMaster();

    setOptionSymbolMaster(optionMaster || {});

    const tokenMetaMap = {};

    Object.values(symbolTokenMap).forEach((s) => {
      tokenMetaMap[s.token] = {
        exchangeType: s.exchangeType,
        symbol: s.symbol
      };
    });

    Object.values(optionMaster || {}).forEach((o) => {
      if (!o?.token) return;
      tokenMetaMap[o.token] = {
        exchangeType: o.exchangeType || 2,
        symbol: o.symbol || ""
      };
    });

    setSymbolMaster(tokenMetaMap);

    setTimeout(angelLogin, 2000);

    setTimeout(() => {
      console.log("🧠 Booting Angel LIVE Engine...");
      startAngelEngine();
    }, 8000);
  } catch (e) {
    console.error("❌ Startup failed:", e.message);
    process.exit(1);
  }
});
