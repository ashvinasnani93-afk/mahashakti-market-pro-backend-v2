// ==================================================
// DYNAMIC INDEX & STOCK MASTER (PRO-VERSION)
// ROLE: Auto-detecting Midcap/Smallcap Breakouts
// NO FIXED LIST | NSE-BSE READY
// ==================================================

/**
 * identifyTradeableStocks
 * @param {Array} liveMarketData - Sabhi stocks ka live data array (LTP, Volume, Symbol)
 * @returns {Array} - Sirf woh stocks jo bhagne ke liye taiyaar hain
 */
function identifyTradeableStocks(liveMarketData = []) {
  if (!Array.isArray(liveMarketData) || liveMarketData.length === 0) {
    return [];
  }

  // --------------------------------------------------
  // DYNAMIC SCANNING LOGIC (Real-Profit Filters)
  // --------------------------------------------------
  const highPotentialStocks = liveMarketData.filter((stock) => {
    const {
      lastPrice,
      prevClose,
      currentVolume,
      avgVolume20Day,
      symbol
    } = stock;

    // 1. PRICE CHANGE FILTER (At least 2% up to ignore noise)
    const priceChangePct = ((lastPrice - prevClose) / prevClose) * 100;
    const isGaining = priceChangePct >= 2.0 && priceChangePct <= 15.0; // 15% tak limit (Upper circuit protection)

    // 2. VOLUME SPIKE FILTER (Smart Money Indicator)
    // Smallcaps mein jab volume average se 2.5 guna hota hai tabhi 10% move aata hai
    const hasVolumeBurst = currentVolume >= (avgVolume20Day * 2.5);

    // 3. EXCLUSION (Penny stocks ko hatane ke liye - Below ₹20)
    const isNotPennyStock = lastPrice > 20;

    return isGaining && hasVolumeBurst && isNotPennyStock;
  });

  // --------------------------------------------------
  // SORT BY HIGHEST POTENTIAL
  // --------------------------------------------------
  return highPotentialStocks.sort((a, b) => {
    const changeA = ((a.lastPrice - a.prevClose) / a.prevClose);
    const changeB = ((b.lastPrice - b.prevClose) / b.prevClose);
    return changeB - changeA; // Sabse zyada bhagne wala stock sabse upar
  });
}

/**
 * getMarketContext
 * Return common indices and identified movers
 */
function getMarketContext(allData) {
  const movers = identifyTradeableStocks(allData);
  
  return {
    indices: ["NIFTY 50", "NIFTY MIDCAP 100", "NIFTY SMALLCAP 100"],
    activeMovers: movers, // Ye list har 1 second mein update hogi
    totalFound: movers.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  identifyTradeableStocks,
  getMarketContext
};
