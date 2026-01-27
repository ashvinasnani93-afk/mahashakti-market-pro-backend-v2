// ==========================================
// MOVERS SCANNER API
// Detects 15-20% Fast Moving Stocks
// Real Angel One Data - NO DUMMY
// ==========================================

const express = require("express");
const router = express.Router();

// Import signal engine
const { finalDecision } = require("../signalDecision.service");

// ==========================================
// GET /scanner/movers?range=15-20
// ==========================================
router.get("/movers", async (req, res) => {
  try {
    const range = req.query.range || "15-20";
    const [minPercent, maxPercent] = range.split("-").map(Number);

    if (!minPercent || !maxPercent) {
      return res.json({
        status: false,
        message: "Invalid range format. Use: 5-10, 10-15, 15-20, 20-30",
      });
    }

    console.log(`🔍 Scanning for ${minPercent}-${maxPercent}% movers...`);

    // Get stock universe (symbols to scan)
    const stockUniverse = getStockUniverse();

    const movers = [];

    // Scan each stock
    for (const stock of stockUniverse) {
      try {
        // Get current LTP from WebSocket feed
        const ltp = getStockLTP(stock.symbol);
        
        if (!ltp || ltp === 0) continue;

        // Get open price (or previous close as fallback)
        const open = getStockOpen(stock.symbol);
        
        if (!open || open === 0) continue;

        // Calculate % change
        const change = ltp - open;
        const changePercent = (change / open) * 100;

        // Filter by range
        const absChange = Math.abs(changePercent);
        if (absChange >= minPercent && absChange <= maxPercent) {
          
          // Get signal for this stock
          const signalData = {
            symbol: stock.symbol,
            close: ltp,
            tradeType: "INTRADAY",
          };

          const signal = finalDecision(signalData);

          movers.push({
            symbol: stock.symbol,
            name: stock.name,
            ltp: Number(ltp.toFixed(2)),
            open: Number(open.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: changePercent.toFixed(2),
            signal: signal?.signal || "WAIT",
            emoji: signal?.emoji || "🟡",
            display: signal?.display || "🟡 WAIT",
            momentumActive: signal?.momentumActive || false,
          });
        }
      } catch (err) {
        console.error(`Error scanning ${stock.symbol}:`, err.message);
        continue;
      }
    }

    // Sort by absolute change (highest first)
    movers.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    console.log(`✅ Found ${movers.length} movers in ${minPercent}-${maxPercent}% range`);

    return res.json({
      status: true,
      range: `${minPercent}-${maxPercent}%`,
      count: movers.length,
      movers,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error("❌ Movers Scanner Error:", error.message);
    return res.json({
      status: false,
      message: "Scanner failed",
    });
  }
});
