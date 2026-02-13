// ==========================================
// MAHASHAKTI - PRODUCTION ANGEL CONFIG
// Merged + Stable + Signal Engine Ready
// ==========================================

require("dotenv").config();

const BASE_URL = "https://apiconnect.angelone.in";
const WS_URL = "wss://smartapisocket.angelone.in/smart-stream";

module.exports = {

  // ==========================================
  // CREDENTIALS (ENV BASED)
  // ==========================================
  credentials: {
    apiKey: process.env.ANGEL_API_KEY,
    clientId: process.env.ANGEL_CLIENT_ID,
    password: process.env.ANGEL_PASSWORD,
    totpSecret: process.env.ANGEL_TOTP_SECRET
  },

  // ==========================================
  // BASE URLS
  // ==========================================
  BASE_URL,
  WS_URL,

  // ==========================================
  // REST ENDPOINTS
  // ==========================================
  ENDPOINTS: {
    LOGIN: "/rest/auth/angelbroking/user/v1/loginByPassword",
    GENERATE_TOKEN: "/rest/auth/angelbroking/jwt/v1/generateTokens",
    PROFILE: "/rest/secure/angelbroking/user/v1/getProfile",
    LOGOUT: "/rest/secure/angelbroking/user/v1/logout",
    RMS: "/rest/secure/angelbroking/user/v1/getRMS",
    LTP: "/rest/secure/angelbroking/order/v1/getLtpData",
    HISTORICAL: "/rest/secure/angelbroking/historical/v1/getCandleData",
    OPTION_CHAIN: "/rest/secure/angelbroking/market/v1/optionChain",
    ORDER_BOOK: "/rest/secure/angelbroking/order/v1/getOrderBook",
    TRADE_BOOK: "/rest/secure/angelbroking/order/v1/getTradeBook",
    PLACE_ORDER: "/rest/secure/angelbroking/order/v1/placeOrder"
  },

  // ==========================================
  // MANDATORY ANGEL HEADERS
  // ==========================================
  HEADERS: {
    CONTENT_TYPE: "application/json",
    ACCEPT: "application/json",
    USER_TYPE: "USER",
    SOURCE_ID: "WEB",
    CLIENT_LOCAL_IP: "127.0.0.1",
    CLIENT_PUBLIC_IP: "106.51.71.158",
    MAC_ADDRESS: "00:00:00:00:00:00"
  },

  // ==========================================
  // MASTER FILE URL
  // ==========================================
  MASTER_URL:
    "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",

  // ==========================================
  // INDEX TOKENS (WebSocket)
  // ==========================================
  INDEX_TOKENS: {
    NIFTY: { token: "26000", exchangeType: 1, symbol: "NIFTY 50" },
    BANKNIFTY: { token: "26009", exchangeType: 1, symbol: "NIFTY BANK" },
    FINNIFTY: { token: "26037", exchangeType: 1, symbol: "NIFTY FIN SERVICE" },
    MIDCPNIFTY: { token: "26074", exchangeType: 1, symbol: "NIFTY MID SELECT" },
    SENSEX: { token: "1", exchangeType: 3, symbol: "SENSEX" }
  },

  // ==========================================
  // HISTORICAL TOKENS
  // ==========================================
  HISTORICAL_TOKENS: {
    NIFTY: { exchange: "NSE", symboltoken: "99926000" },
    BANKNIFTY: { exchange: "NSE", symboltoken: "99926009" },
    FINNIFTY: { exchange: "NSE", symboltoken: "99926037" },
    MIDCPNIFTY: { exchange: "NSE", symboltoken: "99926074" },
    SENSEX: { exchange: "BSE", symboltoken: "99919000" }
  },

  // ==========================================
  // COMMODITY TOKENS (MCX)
  // ==========================================
  COMMODITY_TOKENS: {
    GOLD: { token: "424629", exchangeType: 5 },
    SILVER: { token: "424631", exchangeType: 5 },
    CRUDEOIL: { token: "424633", exchangeType: 5 },
    NATURALGAS: { token: "424634", exchangeType: 5 }
  },

  // ==========================================
  // EXCHANGE TYPES
  // ==========================================
  EXCHANGE_TYPE: {
    NSE: 1,
    NFO: 2,
    BSE: 3,
    BFO: 4,
    MCX: 5,
    CDS: 7
  },

  // ==========================================
  // HISTORICAL INTERVAL LIMITS
  // ==========================================
  VALID_INTERVALS: {
    ONE_MINUTE: { maxDays: 30 },
    THREE_MINUTE: { maxDays: 60 },
    FIVE_MINUTE: { maxDays: 90 },
    TEN_MINUTE: { maxDays: 90 },
    FIFTEEN_MINUTE: { maxDays: 180 },
    THIRTY_MINUTE: { maxDays: 180 },
    ONE_HOUR: { maxDays: 365 },
    ONE_DAY: { maxDays: 2000 }
  },

  // ==========================================
  // TIMEOUT SETTINGS
  // ==========================================
  TIMEOUT: {
    API: 15000,
    WS_HEARTBEAT: 25000,
    WS_RECONNECT: 10000
  }
};
