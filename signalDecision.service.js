// ==================================================
// FINAL DECISION ENGINE (PHASE-C3 | MASTER BRAIN)
// ROLE: Harmonizing all services + Midcap/Smallcap Scanner
// RULES: Practical & Softened for Real Market Profit
// ==================================================


const { generateOptionsSignal } = require("./services/options/optionsSignal.engine");
const { summarizeOI } = require("./services/institutional_oi.service");
const { getPCRContext } = require("./services/institutional_pcr.service");
const { detectFastMove } = require("./services/intradayFastMove.service");
const { getOptionsSafetyContext } = require("./services/options/optionsSafety.service");
const { identifyTradeableStocks } = require("./indexMaster.service");

/**
 * getFinalMarketSignal
 * Inputs: Single stock data OR Array of all market stocks
 */
function getFinalMarketSignal(dataInput) {
  // --------------------------------------------------
  // MULTI-STOCK SCANNER LOGIC (For 10% Gainers)
  // --------------------------------------------------
  if (Array.isArray(dataInput)) {
    const potentialMovers = identifyTradeableStocks(dataInput);
    
    return potentialMovers.map(stock => {
      // Har gainer stock ke liye decision process call karein
      return processSingleStockLogic({
        symbol: stock.symbol,
        ltp: stock.lastPrice,
        prevLtp: stock.prevClose,
        volume: stock.currentVolume,
        avgVolume: stock.avgVolume20Day,
        ema20: stock.ema20 || stock.lastPrice * 0.99, // Fallback logic
        ema50: stock.ema50 || stock.lastPrice * 0.98,
        rsi: stock.rsi || 60,
        vix: 15,
        tradeType: "SCANNER"
      });
    }).filter(res => res.signal !== "WAIT"); 
  }

  // Single Stock Analysis (Standard Postman Request)
  return processSingleStockLogic(dataInput);
}

/**
 * processSingleStockLogic
 * Core decision logic for a specific symbol
 */
function processSingleStockLogic(data = {}) {
  const {
    symbol,
    ltp,
    prevLtp,
    volume,
    avgVolume,
    ema20,
    ema50,
    rsi,
    vix,
    oiData = [],
    pcrValue
  } = data;

  // 1. SAFETY GATE (PRACTICAL RELAXATION)
  const safetyContext = getOptionsSafetyContext({
    vix: vix || 15,
    isExpiryDay: data.isExpiryDay || false,
    isResultDay: data.isResultDay || false
  });

  if (!safetyContext.safety.allowTrade) {
    return { symbol, status: "WAIT", signal: "🟡", reason: safetyContext.safety.reason };
  }

  // 2. MOMENTUM CHECK (SOFTENED)
  const fastMove = detectFastMove({
    ltp,
    prevLtp,
    volume,
    avgVolume,
    trend: ema20 > ema50 ? "UPTREND" : "DOWNTREND"
  });

  // 3. INSTITUTIONAL CONFIRMATION
  const oiAnalysis = summarizeOI(oiData);
  const pcrAnalysis = getPCRContext(pcrValue);

  // 4. FINAL CONFLUENCE
  let finalDecision = "WAIT";
  let uiIcon = "🟡";
  let confidence = "LOW";

  // BULLISH (🟢) - Softened for Midcap breakouts
  const isBullishTrend = ema20 > ema50 || (ltp > prevLtp && rsi > 55);
  const hasMomentum = fastMove.signal === "BUY" || rsi > 60;
  const hasInstitutionalPush = oiAnalysis.bias === "BULLISH" || pcrAnalysis.bias === "BULLISH" || data.tradeType === "SCANNER";

  if (isBullishTrend && hasMomentum && hasInstitutionalPush) {
    finalDecision = "BUY";
    uiIcon = "🟢";
    confidence = (volume > avgVolume * 2) ? "HIGH (BREAKOUT)" : "MEDIUM";
  } 
  // BEARISH (🔴)
  else if (ema20 < ema50 && (fastMove.signal === "SELL" || rsi < 45)) {
    finalDecision = "SELL";
    uiIcon = "🔴";
    confidence = "MEDIUM";
  }

  return {
    status: "OK",
    symbol,
    ltp,
    signal: finalDecision,
    uiIcon,
    confidence,
    volumeSpike: (volume / avgVolume).toFixed(2) + "x",
    actionableNote: finalDecision === "WAIT" 
      ? "Consolidating... No clear breakout." 
      : `${symbol} showing strong momentum. Confidence: ${confidence}`
  };
}

module.exports = { getFinalMarketSignal };
