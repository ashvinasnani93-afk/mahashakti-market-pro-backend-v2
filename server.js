// ==========================================
// MAHASHAKTI MARKET PRO - MAIN SERVER
// REAL ANGEL ONE API INTEGRATION
// Complete Option Chains + Signals
// ==========================================
// Load environment variables FIRST
require('dotenv').config();

const express = require("express");
const cors = require("cors");

// Angel One Services
const { loginWithPassword, generateToken } = require("./services/angel/angelAuth.service");
const { setGlobalTokens, getLtpData } = require("./services/angel/angelApi.service");
const { startAngelWebSocket } = require("./services/angel/angelWebSocket.service");

// Token & Symbol Services
const { initializeTokenService } = require("./token.service");
const { setAllSymbols } = require("./symbol.service");

// API Routes
const optionChainRoutes = require("./routes/optionChain.routes");
const signalRoutes = require("./routes/signal.routes");
const ltpRoutes = require("./routes/ltp.routes");
const signalIntelRoutes = require("./routes/signal.intel.routes");

// ==========================================
// APP INITIALIZATION
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// GLOBAL STATE
// ==========================================
global.angelSession = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
  clientCode: null,
  isLoggedIn: false,
  wsConnected: false
};

global.latestLTP = {};
global.symbolOpenPrice = {};

// ==========================================
// BASIC ROUTES
// ==========================================
app.get("/", (req, res) => {
  res.json({
    status: "LIVE",
    service: "Mahashakti Market Pro API",
    version: "2.0.0",
    realData: true,
    endpoints: {
      optionChain: "/api/option-chain?symbol=NIFTY",
      signal: "/api/signal",
      ltp: "/api/ltp?symbol=NIFTY",
      status: "/api/status"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ==========================================
// SYSTEM STATUS
// ==========================================
app.get("/api/status", (req, res) => {
  res.json({
    status: true,
    angelLogin: global.angelSession.isLoggedIn,
    wsConnected: global.angelSession.wsConnected,
    jwtToken: global.angelSession.jwtToken ? "SET" : "NOT_SET",
    feedToken: global.angelSession.feedToken ? "SET" : "NOT_SET",
    ltpCount: Object.keys(global.latestLTP).length,
    service: "Mahashakti Market Pro",
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// ROUTE MOUNTING
// ==========================================
app.use("/api/option-chain", optionChainRoutes);
app.use("/api/signal", signalRoutes);
app.use("/api/signal/intel", signalIntelRoutes);
app.use("/api/ltp", ltpRoutes);

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    status: false,
    error: err.message || "Internal server error"
  });
});

// ==========================================
// ANGEL ONE LOGIN
// ==========================================
async function performAngelLogin() {
  try {
    const {
      ANGEL_API_KEY,
      ANGEL_CLIENT_ID,
      ANGEL_PASSWORD,
      ANGEL_TOTP_SECRET
    } = process.env;

    if (!ANGEL_API_KEY || !ANGEL_CLIENT_ID || !ANGEL_PASSWORD || !ANGEL_TOTP_SECRET) {
      console.log("⚠️ Angel credentials missing in .env");
      return false;
    }

    console.log("🔐 Logging into Angel One...");

    const result = await loginWithPassword({
      clientCode: ANGEL_CLIENT_ID,
      password: ANGEL_PASSWORD,
      totpSecret: ANGEL_TOTP_SECRET,
      apiKey: ANGEL_API_KEY
    });

    if (result.success) {
      global.angelSession.jwtToken = result.jwtToken;
      global.angelSession.refreshToken = result.refreshToken;
      global.angelSession.feedToken = result.feedToken;
      global.angelSession.clientCode = result.clientCode;
      global.angelSession.isLoggedIn = true;

      // Set tokens for API service
     setGlobalTokens(
  result.jwtToken,
  ANGEL_API_KEY,
  result.clientCode
);

      console.log("✅ Angel One Login SUCCESS");
      console.log("📡 JWT Token:", result.jwtToken.substring(0, 20) + "...");
      console.log("📡 Feed Token:", result.feedToken.substring(0, 20) + "...");

      return true;
    } else {
      console.error("❌ Angel Login Failed:", result.error);
      return false;
    }

  } catch (err) {
    console.error("❌ Login Error:", err.message);
    return false;
  }
}

// ==========================================
// AUTO TOKEN REFRESH (Every 5 hours)
// ==========================================
async function autoRefreshToken() {
  try {
    if (!global.angelSession.refreshToken) return;

    console.log("🔄 Refreshing Angel Token...");

    const result = await generateToken(
      global.angelSession.refreshToken,
      process.env.ANGEL_API_KEY
    );

    if (result.success) {
      global.angelSession.jwtToken = result.jwtToken;
      global.angelSession.refreshToken = result.refreshToken;
      global.angelSession.feedToken = result.feedToken;

      setGlobalTokens(result.jwtToken, process.env.ANGEL_API_KEY);

      console.log("✅ Token Refreshed");
    } else {
      console.error("❌ Token Refresh Failed");
      // Re-login
      performAngelLogin();
    }

  } catch (err) {
    console.error("❌ Auto Refresh Error:", err.message);
  }
}

// Refresh every 5 hours
setInterval(autoRefreshToken, 5 * 60 * 60 * 1000);

// ==========================================
// SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("=".repeat(50));
  console.log("🚀 MAHASHAKTI MARKET PRO - SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log("=".repeat(50));

try {
    // Step 1: Login to Angel One FIRST
    const loginSuccess = await performAngelLogin();

    if (!loginSuccess) {
      console.log("⚠️ Angel login failed — server running in LIMITED MODE");
      return;
    }

    // Step 2: Load Option Master AFTER successful login
    console.log("📥 Loading Option Master...");
    await initializeTokenService();
    console.log("✅ Option Master Loaded");

    // Step 3: System ready
    console.log("🟢 SYSTEM READY: Live LTP + Option Chain + Signals");

  } catch (err) {
    console.error("❌ Startup Error:", err.message);
  }
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down...");
  process.exit(0);
});
