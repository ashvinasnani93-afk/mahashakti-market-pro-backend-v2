// ==========================================
// MAHASHAKTI - FINAL PRODUCTION CANDLE SERVICE
// Angel SmartAPI Compliant + High Performance
// ==========================================

const axios = require("axios");
const settings = require("../../config/settings.config")
const authService = require('./angelAuth.service');
const { BASE_URL, ENDPOINTS } = require("../config/angel.config");

// ==========================================
// VALID INTERVALS (Angel Official Limits)
// ==========================================
const VALID_INTERVALS = {
  ONE_MINUTE: { maxDays: 30 },
  THREE_MINUTE: { maxDays: 60 },
  FIVE_MINUTE: { maxDays: 90 },
  TEN_MINUTE: { maxDays: 90 },
  FIFTEEN_MINUTE: { maxDays: 180 },
  THIRTY_MINUTE: { maxDays: 180 },
  ONE_HOUR: { maxDays: 365 },
  ONE_DAY: { maxDays: 2000 }
};

class CandleService {
  constructor() {
    this.cache = new Map();
    this.cacheTime = new Map();
    this.pending = new Map();
  }

  // ==========================================
  // IST FORMATTER (MANDATORY FOR ANGEL)
  // ==========================================
  formatDateIST(date) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(date.getTime() + istOffset);

    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const d = String(ist.getUTCDate()).padStart(2, "0");
    const h = String(ist.getUTCHours()).padStart(2, "0");
    const min = String(ist.getUTCMinutes()).padStart(2, "0");

    return `${y}-${m}-${d} ${h}:${min}`;
  }

  getKey(token, interval, from) {
    return `${token}_${interval}_${from}`;
  }

  isValidCache(key) {
    const ts = this.cacheTime.get(key);
    if (!ts) return false;
    return Date.now() - ts < settings.candles.cacheExpiryMs;
  }

  // ==========================================
  // MAIN FETCH METHOD
  // ==========================================
  async getCandles(token, exchange, interval = "FIVE_MINUTE", count = 100) {
    if (!VALID_INTERVALS[interval]) {
      throw new Error(`Invalid interval: ${interval}`);
    }

    const maxDays = VALID_INTERVALS[interval].maxDays;

    const now = new Date();
    const from = new Date();
    from.setDate(from.getDate() - Math.min(7, maxDays));
    from.setHours(9, 15, 0, 0);

    const fromDate = this.formatDateIST(from);
    const toDate = this.formatDateIST(now);

    const key = this.getKey(token, interval, fromDate);

    if (this.isValidCache(key)) {
      return this.cache.get(key);
    }

    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = this.fetchFromAngel(
      token,
      exchange,
      interval,
      fromDate,
      toDate,
      count,
      key
    );

    this.pending.set(key, promise);

    try {
      const data = await promise;
      return data;
    } finally {
      this.pending.delete(key);
    }
  }

  async fetchFromAngel(token, exchange, interval, fromDate, toDate, count, key) {
    await authService.ensureAuthenticated();

    try {
      const response = await axios.post(
        `${BASE_URL}${ENDPOINTS.HISTORICAL}`,
        {
          exchange,
          symboltoken: token,
          interval,
          fromdate: fromDate,
          todate: toDate
        },
        {
          headers: authService.getAuthHeaders(),
          timeout: 15000
        }
      );

      if (response.data.status && response.data.data) {
        const raw = response.data.data.slice(-count);

        const candles = raw.map(c => ({
          timestamp: new Date(c[0]).getTime(),
          open: +c[1],
          high: +c[2],
          low: +c[3],
          close: +c[4],
          volume: +c[5] || 0
        }));

        this.cache.set(key, candles);
        this.cacheTime.set(key, Date.now());

        return candles;
      }

      return [];
    } catch (err) {
      console.error("[CANDLE] Angel API Error:", err.message);
      return [];
    }
  }

  // ==========================================
  // MULTI TIMEFRAME FETCH
  // ==========================================
  async getMultiTF(token, exchange) {
    const [m5, m15, h1, d1] = await Promise.all([
      this.getCandles(token, exchange, "FIVE_MINUTE", 100),
      this.getCandles(token, exchange, "FIFTEEN_MINUTE", 50),
      this.getCandles(token, exchange, "ONE_HOUR", 30),
      this.getCandles(token, exchange, "ONE_DAY", 60)
    ]);

    return { m5, m15, h1, d1 };
  }

  // ==========================================
  // HELPERS FOR INDICATOR ENGINE
  // ==========================================
  extractOHLCV(candles) {
    return {
      opens: candles.map(c => c.open),
      highs: candles.map(c => c.high),
      lows: candles.map(c => c.low),
      closes: candles.map(c => c.close),
      volumes: candles.map(c => c.volume),
      timestamps: candles.map(c => c.timestamp)
    };
  }

  getLatest(candles) {
    if (!candles || candles.length === 0) return null;
    return candles[candles.length - 1];
  }

  clearCache() {
    this.cache.clear();
    this.cacheTime.clear();
  }
}

module.exports = new CandleService();
