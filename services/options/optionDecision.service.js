// ==================================================
// OPTION DECISION SERVICE (PHASE-4 | STEP-2A)
// FINAL OPTIONS DECISION BRAIN
// BUY vs SELL vs NO-TRADE (TEXT + UI SYMBOL)
// RULE-LOCKED | NO EXECUTION
// ==================================================

const { generateOptionsSignal } = require("./optionsSignal.engine");

/**
 * decideOptionTrade
 * @param {object} data
 * @returns {object}
 *
 * This service:
 * - FINAL decision wrapper for OPTIONS only
 * - BUY / SELL / NO-TRADE (TEXT + UI SYMBOL)
 * - Theta decay awareness (TEXT)
 * - Greeks bias awareness (TEXT)
 * - Expiry + Overnight risk awareness
 * - Clear separation from Equity logic
 */
function decideOptionTrade(data = {}) {
  // ----------------------------------
  // HARD INPUT CHECK
  // ----------------------------------
  if (!data || typeof data !== "object") {
    return {
      status: "WAIT",
      decision: "NO_TRADE",
      uiSignal: "WAIT",
      uiColor: "YELLOW",
      uiIcon: "🟡",
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
      uiSignal: signalContext?.uiSignal || "WAIT",
      uiColor: signalContext?.uiColor || "YELLOW",
      uiIcon: signalContext?.uiIcon || "🟡",
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

    // 🔒 UI SIGNAL (LOCKED FROM ENGINE)
    uiSignal,
    uiColor,
    uiIcon,
  } = signalContext;

  // ----------------------------------
  // STEP 2: EXPIRY + OVERNIGHT RISK
  // ----------------------------------
  let expiryRiskNote = "Normal expiry risk";

  if (data.expiryType === "WEEKLY_EXPIRY") {
    expiryRiskNote =
      "Weekly expiry: fast theta decay and sudden premium movement risk";
  }

  if (data.expiryType === "MONTHLY_EXPIRY") {
    expiryRiskNote =
      "Monthly expiry: moderate theta decay, overnight gap risk exists";
  }

  let overnightRiskNote =
    data.tradeContext === "POSITIONAL_OPTIONS"
      ? "Overnight risk present: gap-up / gap-down possible"
      : "Intraday options: no overnight holding risk";

  // ----------------------------------
  // STEP 3: THETA DECAY CONTEXT
  // ----------------------------------
  let thetaNote = "Theta impact neutral";

  if (data.expiryType === "WEEKLY_EXPIRY") {
    thetaNote = "High theta decay: time works against option buyers";
  }

  if (data.expiryType === "MONTHLY_EXPIRY") {
    thetaNote = "Moderate theta decay: time impact slower than weekly";
  }

  // ----------------------------------
  // STEP 4: GREEKS CONTEXT (SIMPLIFIED)
  // ----------------------------------
  let greeksNote = "Greeks balanced";

  if (trend === "UPTREND") {
    greeksNote = "Positive delta bias; gamma sensitivity manageable";
  }

  if (trend === "DOWNTREND") {
    greeksNote = "Negative delta bias; gamma risk during fast moves";
  }

  if (regime === "SIDEWAYS") {
    greeksNote =
      "Theta dominant; option selling favoured, vega contraction likely";
  }

 // STEP 5: OPTION SELL DECISION (PRIORITY)
if (sellerAllowed) {
  return {
    status: "OK",
    decision: "OPTION_SELL_ALLOWED",
    mode: "OPTIONS_SELLER",

    uiSignal,
    uiColor,
    uiIcon,

    trend,
    regime,
    strategy: sellerStrategy || "RANGE_SELL",

    thetaContext: thetaNote,
    greeksContext: greeksNote,
    expiryRisk: expiryRiskNote,
    overnightRisk: overnightRiskNote,

    reason: sellerReason || "Options seller conditions satisfied",
    note:
      "Options SELL allowed. Premium decay works in favour, but risk is unlimited.",
  };
}

// STEP 6: OPTION BUY DECISION
if (buyerAllowed) {
  return {
    status: "OK",
    decision: "OPTION_BUY_ALLOWED",
    mode: "OPTIONS_BUYER",

    uiSignal,
    uiColor,
    uiIcon,

    trend,
    regime,
    thetaContext: thetaNote,
    greeksContext: greeksNote,
    expiryRisk: expiryRiskNote,
    overnightRisk: overnightRiskNote,

    reason: buyerReason || "Options buyer conditions satisfied",
    note:
      "Options BUY allowed. Premium decay risk applies. This is NOT equity buying.",
  };
}

  // ----------------------------------
  // STEP 7: NO TRADE
  // ----------------------------------
  return {
    status: "WAIT",
    decision: "NO_TRADE",

    // 🔥 UI OUTPUT
    uiSignal,
    uiColor,
    uiIcon,

    trend,
    regime,
    thetaContext: thetaNote,
    greeksContext: greeksNote,
    expiryRisk: expiryRiskNote,
    overnightRisk: overnightRiskNote,

    reason: "Neither buyer nor seller conditions satisfied",
  };
}

// ==================================================
// EXPORT
// ==================================================
module.exports = {
  decideOptionTrade,
};
