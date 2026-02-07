// ==========================================
// SIGNAL ROUTES
// MAHASHAKTI MARKET PRO
// Exposes /signal endpoint
// ==========================================

const express = require("express");
const router = express.Router();

const { buildEngineData } = require("../services/marketFeed.service");
const { finalDecision } = require("../signalDecision.service");

// ===============================
// POST /signal
// ===============================
router.post("/", (req, res) => {
  try {
    const raw = req.body || {};

    // STEP 1: Normalize market feed
    const engineData = buildEngineData(raw);

    if (!engineData) {
      return res.json({
        status: false,
        signal: "WAIT",
        reason: "Invalid input data",
      });
    }

    // STEP 2: Run decision engine
    const result = finalDecision(engineData);

    // STEP 3: Send response
    return res.json({
      status: true,
      symbol: engineData.symbol,
      signal: result.signal,
      confidence: result.confidence,
      reason: result.reason,
      analysis: result.analysis,
      notes: result.notes,
      timestamp: result.timestamp,
    });
  } catch (err) {
    console.error("❌ Signal Route Error:", err.message);

    return res.status(500).json({
      status: false,
      signal: "WAIT",
      error: "Signal route failed",
    });
  }
});

module.exports = router;
