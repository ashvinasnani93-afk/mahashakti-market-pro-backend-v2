// ==========================================
// ANGEL CANDLES SERVICE (PRODUCTION SAFE)
// MAHASHAKTI MARKET PRO
// ==========================================

const axios = require("axios");

const BASE_URL = "https://apiconnect.angelone.in";

// ================= INDEX TOKEN MAP =================

const INDEX_TOKENS = {
  NIFTY: { token: "99926000", exchange: "NSE" },
  BANKNIFTY: { token: "99926009", exchange: "NSE" },
  FINNIFTY: { token: "99926037", exchange: "NSE" },
  SENSEX: { token: "99919000", exchange: "BSE" },
  MIDCPNIFTY: { token: "99926074", exchange: "NSE" }
};

// ================= SESSION VALIDATION =================

function validateSession() {
  const session = global.angelSession;

  if (!session || !session.jwtToken || !session.apiKey) {
    return {
      valid: false,
      error: "Angel session missing or expired"
    };
  }

  return { valid: true, session };
}

// ================= HEADERS =================

function getHeaders(session) {
  return {
    Authorization: `Bearer ${session.jwtToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": process.env.ANGEL_LOCAL_IP || "127.0.0.1",
    "X-ClientPublicIP": process.env.ANGEL_PUBLIC_IP,
    "X-MACAddress": process.env.ANGEL_MAC_ADDRESS,
    "X-PrivateKey": session.apiKey
  };
}

// ================= DATE FORMAT =================

function formatDate(date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

// ================= GET INDEX INFO =================

function getIndexInfo(symbol) {
  const clean = symbol.toUpperCase().replace(/\s+/g, "");
  return INDEX_TOKENS[clean] || null;
}

// ================= FETCH CANDLES =================

async function fetchCandles(symbol, interval = "FIFTEEN_MINUTE", count = 100) {
  const startTime = Date.now();

  const sessionCheck = validateSession();
  if (!sessionCheck.valid) {
    return {
      success: false,
      error: sessionCheck.error,
      candles: []
    };
  }

  const { session } = sessionCheck;

  const indexInfo = getIndexInfo(symbol);
  if (!indexInfo) {
    return {
      success: false,
      error: `Unsupported symbol: ${symbol}`,
      candles: []
    };
  }

  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 10); // 10 days safety buffer

    const payload = {
      exchange: indexInfo.exchange,
      symboltoken: indexInfo.token,
      interval,
      fromdate: formatDate(fromDate),
      todate: formatDate(toDate)
    };

    const response = await axios.post(
      `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
      payload,
      {
        headers: getHeaders(session),
        timeout: 8000
      }
    );

    const executionTime = Date.now() - startTime;

    if (!response.data || !response.data.status || !response.data.data) {
      return {
        success: false,
        error: response.data?.message || "Angel API error",
        candles: [],
        executionTime
      };
    }

    const rawCandles = response.data.data;

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return {
        success: false,
        error: "No candle data returned",
        candles: [],
        executionTime
      };
    }

    const candles = rawCandles.slice(-count).map(c => ({
      timestamp: c[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5])
    }));

    if (candles.length < 50) {
      return {
        success: false,
        error: "Insufficient candle data",
        candles,
        executionTime
      };
    }

    return {
      success: true,
      symbol,
      exchange: indexInfo.exchange,
      token: indexInfo.token,
      candleCount: candles.length,
      candles,
      executionTime
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      candles: [],
      executionTime: Date.now() - startTime
    };
  }
}

// ================= OHLCV EXTRACT =================

function extractOHLCV(candles) {
  return {
    opens: candles.map(c => c.open),
    highs: candles.map(c => c.high),
    lows: candles.map(c => c.low),
    closes: candles.map(c => c.close),
    volumes: candles.map(c => c.volume),
    timestamps: candles.map(c => c.timestamp)
  };
}

// ================= EXPORT =================

module.exports = {
  fetchCandles,
  extractOHLCV,
  getIndexInfo
};
