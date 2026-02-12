// ==========================================
// MARKET SCANNER ENGINE - INSTITUTIONAL GRADE
// MAHASHAKTI MARKET PRO
// Scans: NIFTY 500, F&O stocks, Volume spikes, Breakouts
// ==========================================

const { getFullQuote } = require("./angel/angelApi.service");
const { calculateIndicators } = require("./indicators.service");

// ==========================================
// SCANNER CONFIG
// ==========================================
const SCAN_INTERVAL = 45000; // 45 seconds
const VOLUME_SPIKE_THRESHOLD = 1.5; // 1.5x average volume
const BREAKOUT_PROXIMITY = 0.98; // 98% of range high
const MIN_LIQUIDITY = 100000; // Minimum volume for consideration

let scannerActive = false;
let lastScanResults = null;
let lastScanTime = null;

// ==========================================
// NIFTY 500 STOCKS (TOP LIQUID STOCKS)
// ==========================================
const NIFTY_500_SYMBOLS = [
  // NIFTY 50
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK",
  "SBIN", "BHARTIARTL", "BAJFINANCE", "ITC", "ASIANPAINT", "LT", "AXISBANK",
  "MARUTI", "TITAN", "SUNPHARMA", "ULTRACEMCO", "NESTLEIND", "WIPRO", "HCLTECH",
  "TECHM", "POWERGRID", "NTPC", "BAJAJFINSV", "ONGC", "TATAMOTORS", "ADANIPORTS",
  "COALINDIA", "M&M", "TATASTEEL", "JSWSTEEL", "INDUSINDBK", "HINDALCO", "DRREDDY",
  "CIPLA", "DIVISLAB", "EICHERMOT", "GRASIM", "BPCL", "TATACONSUM", "HEROMOTOCO",
  "SHREECEM", "UPL", "SBILIFE", "APOLLOHOSP", "BRITANNIA", "ADANIENT", "BAJAJ-AUTO",
  
  // ADDITIONAL F&O STOCKS
  "VEDL", "TATAPOWER", "SAIL", "CANBK", "PNB", "BANKBARODA", "UNIONBANK",
  "IDFCFIRSTB", "RECLTD", "PFC", "LICHSGFIN", "CHOLAFIN", "MUTHOOTFIN",
  "IDFC", "FEDERALBNK", "AUBANK", "BANDHANBNK", "RBLBANK", "DELTACORP",
  "IDEA", "ZEEL", "SAIL", "NMDC", "NATIONALUM", "GMRINFRA", "ADANIPOWER",
  "TORNTPOWER", "ADANIGREEN", "IRCTC", "DIXON", "ZOMATO", "PAYTM", "NYKAA",
  "POLICYBZR", "DMART", "JUBLFOOD", "BERGEPAINT", "PIDILITIND", "AARTI IND",
  "NAVINFLUOR", "SRF", "DEEPAKNTR", "ATUL", "BALRAMCHIN", "ALKYLAMINE",
  "CHAMBLFERT", "COROMANDEL", "GNFC", "GSFC", "MANGCHEFER", "TATACHEM",
  "FACT", "NFL", "RAIN", "NOCIL", "FINEORG", "TEJASNET", "ROUTE", "TANLA",
  "PERSISTENT", "COFORGE", "MPHASIS", "LTTS", "OFSS", "MINDTREE", "L&TFH",
  "MFSL", "CDSL", "CAMS", "MAZDOCK", "CONCOR", "BHARATFORG", "EXIDEIND",
  "AMBUJACEM", "ACC", "RAMCOCEM", "JKCEMENT", "INDIACEM", "ORIENTCEM"
];

// ==========================================
// INDEX SYMBOLS
// ==========================================
const INDEX_SYMBOLS = [
  "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"
];

// ==========================================
// UNIVERSAL WATCHLIST (NIFTY 500 + INDICES)
// ==========================================
function getUniversalWatchlist() {
  return [...NIFTY_500_SYMBOLS, ...INDEX_SYMBOLS];
}

// ==========================================
// START SCANNER
// ==========================================
function startScanner() {
  if (scannerActive) {
    console.log("[SCANNER] Already running");
    return { success: false, message: "Scanner already active" };
  }

  scannerActive = true;
  console.log("[SCANNER] 🚀 Starting Market Scanner Engine");

  // Run first scan immediately
  runScan();

  // Schedule periodic scans
  global.scannerInterval = setInterval(() => {
    runScan();
  }, SCAN_INTERVAL);

  return { success: true, message: "Scanner started", interval: SCAN_INTERVAL };
}

// ==========================================
// STOP SCANNER
// ==========================================
function stopScanner() {
  if (!scannerActive) {
    return { success: false, message: "Scanner not running" };
  }

  scannerActive = false;
  
  if (global.scannerInterval) {
    clearInterval(global.scannerInterval);
    global.scannerInterval = null;
  }

  console.log("[SCANNER] 🛑 Scanner stopped");
  
  return { success: true, message: "Scanner stopped" };
}

// ==========================================
// RUN SCAN - CORE LOGIC
// ==========================================
async function runScan() {
  try {
    console.log("[SCANNER] 📊 Running market scan...");
    
    const startTime = Date.now();
    const watchlist = getUniversalWatchlist();

    // Fetch full quotes for all symbols (batch mode)
    const quotesResult = await getFullQuote(watchlist);

    if (!quotesResult.success || !quotesResult.data) {
      console.error("[SCANNER] ❌ Failed to fetch quotes");
      return;
    }

    console.log(`[SCANNER] ✅ Fetched ${quotesResult.successful} quotes in ${Date.now() - startTime}ms`);

    // Process each quote
    const scannedStocks = [];

    for (const quoteData of quotesResult.data) {
      if (!quoteData.success || !quoteData.data) continue;

      const quote = quoteData.data;
      const symbol = quoteData.originalSymbol || quoteData.symbol;

      // Liquidity filter
      if (quote.volume < MIN_LIQUIDITY) {
        continue;
      }

      // Calculate derived metrics
      const metrics = calculateDerivedMetrics(quote);

      // Detect patterns
      const patterns = detectPatterns(quote, metrics);

      scannedStocks.push({
        symbol,
        exchange: quoteData.exchange,
        token: quoteData.token,
        quote,
        metrics,
        patterns,
        timestamp: new Date().toISOString()
      });
    }

    // Sort by relevance
    const sortedResults = sortByRelevance(scannedStocks);

    // Store results
    lastScanResults = {
      timestamp: new Date().toISOString(),
      totalScanned: watchlist.length,
      successful: quotesResult.successful,
      filtered: scannedStocks.length,
      topMovers: sortedResults.topMovers,
      volumeSpikes: sortedResults.volumeSpikes,
      breakouts: sortedResults.breakouts,
      preBreakouts: sortedResults.preBreakouts,
      rangeExpansions: sortedResults.rangeExpansions,
      vwapDeviations: sortedResults.vwapDeviations,
      scanDuration: Date.now() - startTime
    };

    lastScanTime = Date.now();

    console.log(`[SCANNER] ✅ Scan complete: ${scannedStocks.length} stocks processed`);
    console.log(`[SCANNER] 📈 Top Movers: ${sortedResults.topMovers.length}`);
    console.log(`[SCANNER] 🔊 Volume Spikes: ${sortedResults.volumeSpikes.length}`);
    console.log(`[SCANNER] 💥 Breakouts: ${sortedResults.breakouts.length}`);

  } catch (error) {
    console.error("[SCANNER] ❌ Scan error:", error.message);
  }
}

// ==========================================
// CALCULATE DERIVED METRICS
// ==========================================
function calculateDerivedMetrics(quote) {
  const { open, high, low, close, prevClose, volume, vwap } = quote;

  // Percentage change
  const changePercent = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;

  // Range
  const range = high - low;
  const rangePercent = low > 0 ? (range / low) * 100 : 0;

  // Position in range (0 = low, 1 = high)
  const positionInRange = range > 0 ? (close - low) / range : 0.5;

  // VWAP deviation
  const vwapDeviation = vwap > 0 ? ((close - vwap) / vwap) * 100 : 0;

  // Buying pressure (simplified)
  const buyingPressure = quote.totalBuyQty > 0 ? 
    quote.totalBuyQty / (quote.totalBuyQty + quote.totalSellQty) : 0.5;

  // Volume ratio (need historical data for avgVolume - using estimate)
  const estimatedAvgVolume = volume * 0.8; // Rough estimate
  const volumeRatio = volume / estimatedAvgVolume;

  // ATR estimate (using range as proxy)
  const atrEstimate = rangePercent;

  return {
    changePercent: parseFloat(changePercent.toFixed(2)),
    range,
    rangePercent: parseFloat(rangePercent.toFixed(2)),
    positionInRange: parseFloat(positionInRange.toFixed(2)),
    vwapDeviation: parseFloat(vwapDeviation.toFixed(2)),
    buyingPressure: parseFloat(buyingPressure.toFixed(2)),
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    atrEstimate: parseFloat(atrEstimate.toFixed(2)),
    isAboveVWAP: close > vwap,
    isBullishCandle: close > open,
    bodyPercent: range > 0 ? Math.abs(close - open) / range * 100 : 0
  };
}

// ==========================================
// DETECT PATTERNS
// ==========================================
function detectPatterns(quote, metrics) {
  const patterns = {
    volumeSpike: false,
    breakout: false,
    preBreakout: false,
    rangeExpansion: false,
    vwapBounce: false,
    strongMomentum: false,
    compression: false
  };

  // Volume spike
  if (metrics.volumeRatio >= VOLUME_SPIKE_THRESHOLD) {
    patterns.volumeSpike = true;
  }

  // Breakout (close near high)
  if (metrics.positionInRange >= 0.95 && metrics.isBullishCandle) {
    patterns.breakout = true;
  }

  // Pre-breakout (close near previous range high)
  if (metrics.positionInRange >= BREAKOUT_PROXIMITY && metrics.positionInRange < 0.95) {
    patterns.preBreakout = true;
  }

  // Range expansion (ATR increasing)
  if (metrics.rangePercent > 2) {
    patterns.rangeExpansion = true;
  }

  // VWAP bounce
  if (metrics.isAboveVWAP && Math.abs(metrics.vwapDeviation) < 0.5) {
    patterns.vwapBounce = true;
  }

  // Strong momentum
  if (Math.abs(metrics.changePercent) > 2 && metrics.volumeRatio > 1.2) {
    patterns.strongMomentum = true;
  }

  // Compression (low range, high volume)
  if (metrics.rangePercent < 1 && metrics.volumeRatio > 1) {
    patterns.compression = true;
  }

  return patterns;
}

// ==========================================
// SORT BY RELEVANCE
// ==========================================
function sortByRelevance(stocks) {
  const topMovers = stocks
    .filter(s => Math.abs(s.metrics.changePercent) > 1)
    .sort((a, b) => Math.abs(b.metrics.changePercent) - Math.abs(a.metrics.changePercent))
    .slice(0, 50);

  const volumeSpikes = stocks
    .filter(s => s.patterns.volumeSpike)
    .sort((a, b) => b.metrics.volumeRatio - a.metrics.volumeRatio)
    .slice(0, 30);

  const breakouts = stocks
    .filter(s => s.patterns.breakout)
    .sort((a, b) => b.metrics.volumeRatio - a.metrics.volumeRatio)
    .slice(0, 20);

  const preBreakouts = stocks
    .filter(s => s.patterns.preBreakout)
    .sort((a, b) => b.metrics.positionInRange - a.metrics.positionInRange)
    .slice(0, 20);

  const rangeExpansions = stocks
    .filter(s => s.patterns.rangeExpansion)
    .sort((a, b) => b.metrics.rangePercent - a.metrics.rangePercent)
    .slice(0, 20);

  const vwapDeviations = stocks
    .filter(s => Math.abs(s.metrics.vwapDeviation) > 1)
    .sort((a, b) => Math.abs(b.metrics.vwapDeviation) - Math.abs(a.metrics.vwapDeviation))
    .slice(0, 20);

  return {
    topMovers,
    volumeSpikes,
    breakouts,
    preBreakouts,
    rangeExpansions,
    vwapDeviations
  };
}

// ==========================================
// GET SCAN RESULTS
// ==========================================
function getScanResults() {
  if (!lastScanResults) {
    return {
      success: false,
      message: "No scan results available. Start scanner first."
    };
  }

  const age = Date.now() - lastScanTime;
  const ageSeconds = Math.floor(age / 1000);

  return {
    success: true,
    age: ageSeconds,
    data: lastScanResults
  };
}

// ==========================================
// GET TOP CANDIDATES (FOR WS FOCUS)
// ==========================================
function getTopCandidates(limit = 100) {
  if (!lastScanResults) {
    return [];
  }

  const candidates = new Set();

  // Top 50 movers
  lastScanResults.topMovers?.slice(0, 50).forEach(stock => {
    candidates.add({
      symbol: stock.symbol,
      exchange: stock.exchange,
      token: stock.token,
      reason: `Mover: ${stock.metrics.changePercent}%`
    });
  });

  // Top 30 volume spikes
  lastScanResults.volumeSpikes?.slice(0, 30).forEach(stock => {
    candidates.add({
      symbol: stock.symbol,
      exchange: stock.exchange,
      token: stock.token,
      reason: `Volume: ${stock.metrics.volumeRatio}x`
    });
  });

  // Top 20 breakouts
  lastScanResults.breakouts?.slice(0, 20).forEach(stock => {
    candidates.add({
      symbol: stock.symbol,
      exchange: stock.exchange,
      token: stock.token,
      reason: "Breakout"
    });
  });

  const candidateArray = Array.from(candidates);
  
  return candidateArray.slice(0, limit);
}

// ==========================================
// MANUAL SCAN (ON-DEMAND)
// ==========================================
async function manualScan() {
  console.log("[SCANNER] 🔍 Manual scan triggered");
  await runScan();
  return getScanResults();
}

// ==========================================
// GET SCANNER STATUS
// ==========================================
function getScannerStatus() {
  return {
    active: scannerActive,
    lastScanTime: lastScanTime ? new Date(lastScanTime).toISOString() : null,
    lastScanAge: lastScanTime ? Math.floor((Date.now() - lastScanTime) / 1000) : null,
    interval: SCAN_INTERVAL,
    watchlistSize: getUniversalWatchlist().length
  };
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  startScanner,
  stopScanner,
  runScan,
  manualScan,
  getScanResults,
  getTopCandidates,
  getScannerStatus,
  getUniversalWatchlist,
  NIFTY_500_SYMBOLS,
  INDEX_SYMBOLS
};
