// ==========================================
// OPTION CHAIN API – FINAL (A3.5)
// Angel = SINGLE SOURCE OF TRUTH
// ==========================================

const { getValidStrikes } = require("./strike.service");
const { buildOptionChain } = require("./optionChain.service");

// ==========================================
// GET OPTION CHAIN
// /option-chain?index=BANKNIFTY&expiry=2025-01-30
// ==========================================
async function getOptionChain(req, res) {
  try {
    const { index, expiry } = req.query;

    // -------------------------------
    // BASIC VALIDATION
    // -------------------------------
    if (!index || !expiry) {
      return res.json({
        status: false,
        message: "index and expiry required",
      });
    }

    const INDEX = index.toUpperCase();
    const expiryDate = new Date(expiry);

    if (isNaN(expiryDate.getTime())) {
      return res.json({
        status: false,
        message: "invalid expiry date",
      });
    }

    // -------------------------------
    // STRIKES (ANGEL SOURCE OF TRUTH)
    // -------------------------------
    const strikes = getValidStrikes({
      index: INDEX,
      expiryDate,
    });

    if (!Array.isArray(strikes) || strikes.length === 0) {
      return res.json({
        status: false,
        message: "no valid strikes from Angel",
      });
    }

    // -------------------------------
    // BUILD OPTION CHAIN
    // -------------------------------
    const chain = buildOptionChain({
      index: INDEX,
      expiryDate,
      strikes,
    });

    // -------------------------------
    // RESPONSE
    // -------------------------------
    return res.json({
      status: true,
      index: INDEX,
      expiry: expiryDate.toISOString().slice(0, 10),
      totalStrikes: Object.keys(chain).length,
      chain,
    });
  } catch (e) {
    console.error("❌ OptionChain API Error:", e);
    return res.json({
      status: false,
      message: "option chain internal error",
    });
  }
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getOptionChain,
};
