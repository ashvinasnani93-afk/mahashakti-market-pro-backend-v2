// ==================================================
// OPTION DECISION SERVICE (PHASE-4)
// FINAL OPTIONS DECISION BRAIN
// Buyer vs Seller | Theta | Greeks | Risk Context
// NO EXECUTION | RULE-LOCKED
// ==================================================

const { generateOptionsSignal } = require("./optionsSignal.engine");

/**
 * decideOptionTrade
 * @param {object} data
 * @returns {object}
 *
 * This service:
 * - Takes final context
 * - Decides BUY / SELL / NO_TRADE (TEXT only)
 * - Adds Theta decay awareness (text)
 * - Adds Greeks bias awareness (text)
 * - Gives clear, explainable reason
 */
function decideOptionTrade(data = {}) {
  // ----------------------------------
  // HARD INPUT CHECK
  // ----------------------------------
  if (!data || typeof data !== "object") {
    return {
      status: "WAIT",
      decision: "NO_TRADE",
      reason: "Invalid options decision input",
    };
  }

  // ----------------------------------
  // STEP 1: CORE OPTIONS SIGNAL ENGINE
  // ----------------------------------
  const signalContext = generateOptionsSignal(data);

  if (!signalContext || signalContext.status !== "READY") {
    return {
      status: "WAIT",
      decision: "NO_TRADE",
      reason: signalContext?.reason || "Options signal not ready",
    };
  }

  const {
    buyerAllowed,
    sellerAllowed,
    trend,
    regime,
    buyerReason,
    sellerReason,
    sellerStrategy,
  } = signalContext;

  // ----------------------------------
  // STEP 2: THETA DECAY AWARENESS (TEXT ONLY)
  // ----------------------------------
  let thetaNote = "Theta neutral";

  if (data.expiryType === "WEEKLY_EXPIRY") {
    thetaNote = "High theta decay risk (weekly expiry)";
  }

  if (data.expiryType === "MONTHLY_EXPIRY") {
    thetaNote = "Moderate theta decay (monthly expiry)";
  }

  // ----------------------------------
  // STEP 3: GREEKS AWARENESS (SIMPLIFIED TEXT)
  // ----------------------------------
  let greeksNote = "Greeks neutral";

  if (trend === "UPTREND") {
    greeksNote = "Delta supportive, Gamma risk controlled";
  }

  if (trend === "DOWNTREND") {
    greeksNote = "Negative delta bias, gamma sensitivity present";
  }

  if (regime === "SIDEWAYS") {
    greeksNote = "Theta dominant, Vega contraction expected";
  }

  // ----------------------------------
  // STEP 4: BUYER DECISION
  // ----------------------------------
  if (buyerAllowed) {
    return {
      status: "OK",
      decision: "OPTION_BUY_ALLOWED",
      mode: "BUYER",
      trend,
      regime,
      thetaContext: thetaNote,
      greeksContext: greeksNote,
      reason: buyerReason || "Buyer conditions satisfied",
      note: "Options BUY allowed (execution handled elsewhere)",
    };
  }

  // ----------------------------------
  // STEP 5: SELLER DECISION
  // ----------------------------------
  if (sellerAllowed) {
    return {
      status: "OK",
      decision: "OPTION_SELL_ALLOWED",
      mode: "SELLER",
      trend,
      regime,
      strategy: sellerStrategy || "RANGE_SELL",
      thetaContext: thetaNote,
      greeksContext: greeksNote,
      reason: sellerReason || "Seller conditions satisfied",
      note: "Options SELL allowed (execution handled elsewhere)",
    };
  }

  // ----------------------------------
  // STEP 6: NO TRADE
  // ----------------------------------
  return {
    status: "WAIT",
    decision: "NO_TRADE",
    trend,
    regime,
    thetaContext: thetaNote,
    greeksContext: greeksNote,
    reason: "Neither buyer nor seller conditions satisfied",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideOptionTrade,
};
