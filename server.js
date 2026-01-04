// ==========================================
// MAHASHAKTI MARKET PRO
// FINAL – ALL STOCKS + OPTIONS LTP
// ==========================================

const express = require("express");
const cors = require("cors");
const https = require("https");
const { SmartAPI } = require("smartapi-javascript");
const { authenticator } = require("otplib");

const { getSignal } = require("./signal.api");
const { getOptionChain } = require("./optionchain.api");
const { getOptions } = require("./options.api");
const { getIndexConfigAPI } = require("./index.api");
const { getCommodity } = require("./commodity.api");
const { getLongTerm } = require("./longTerm.api");

const { loadOptionSymbolMaster } = require("./token.service");

const app = express();
app.use(cors());
app.use(express.json());

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
// API ROUTES (FINAL WIRING)
// ==========================================

app.post("/signal", getSignal);              // Equity / Index
app.post("/options", getOptions);            // Options decision
app.get("/option-chain", getOptionChain);    // Option chain
app.post("/commodity", getCommodity);        // Commodity
app.post("/index/config", getIndexConfigAPI);// Index registry
app.post("/long-term", getLongTerm);         // Long-term equity

// ==========================================
// GLOBAL STATE
// ==========================================
let smartApi;
let ws;
let feedToken = null;
let isLoggingIn = false;

let symbolTokenMap = {};
let tokenSymbolMap = {};
let subscribedTokens = new Set();
let latestLTP = {};

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

    console.log("✅ Angel Login SUCCESS");
    startWebSocket();
  } catch (e) {
    console.error("❌ Angel Login Error:", e);
    setTimeout(angelLogin, 5000);
  } finally {
    isLoggingIn = false;
  }
}

// ==========================================
// WEBSOCKET
// ==========================================
function startWebSocket() {
  if (!feedToken) return;

  const WebSocket = require("ws");
  const wsUrl =
    `wss://smartapisocket.angelone.in/smart-stream` +
    `?clientCode=${ANGEL_CLIENT_ID}` +
    `&feedToken=${feedToken}` +
    `&apiKey=${ANGEL_API_KEY}`;

  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log("🟢 WebSocket Connected");
    subscribedTokens.clear();
  });

  ws.on("message", (data) => {
    if (!Buffer.isBuffer(data)) return;
    if (data.length !== 51) return;

    const ltp = decodeLTP(data);
    const token = data.toString("utf8", 2, 27).replace(/\0/g, "");
    const symbol = tokenSymbolMap[token];
    if (symbol && ltp) latestLTP[symbol] = ltp;
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket Disconnected – reconnecting...");
    setTimeout(startWebSocket, 3000);
  });
}

// ==========================================
// STOCK LTP API
// ==========================================
app.get("/angel/ltp", (req, res) => {
  const symbol = req.query.symbol?.toUpperCase();
  if (!symbol || !symbolTokenMap[symbol]) {
    return res.json({ status: false, message: "symbol invalid" });
  }

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
// START SERVER
// ==========================================
app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);
  try {
    await loadSymbolMaster();
    await loadOptionSymbolMaster();
    await angelLogin();
  } catch (e) {
    console.error("❌ Startup failed:", e);
    process.exit(1);
  }
});
