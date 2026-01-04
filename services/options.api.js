// ==========================================
// OPTIONS API (PHASE-4 | STEP-2C FINAL)
// Single Entry Point for Options Module
// SAFETY → DECISION → UI RESPONSE
// NO EXECUTION | FRONTEND READY
// ==========================================

const { getOptionsContext } = require("./optionsMaster.service");
const { getOptionsSafetyContext } = require("./optionsSafety.service");
const { decideOptionTrade } = require("./optionDecision.service");

// ==========================================
// POST /options
// ==========================================
function getOptions(req, res) {
try {
const body = req.body;

// -----------------------------  
// BASIC INPUT CHECK  
// -----------------------------  
if (!body || typeof body !== "object") {  
  return res.json({  
    status: false,  
    message: "Invalid options input",  
  });  
}  

if (!body.symbol || typeof body.spotPrice !== "number") {  
  return res.json({  
    status: false,  
    message: "symbol and spotPrice required",  
  });  
}  

// -----------------------------  
// STEP 1: OPTIONS MASTER CONTEXT  
// (mapping aligned with master service)  
// -----------------------------  
const optionsContext = getOptionsContext({  
  symbol: body.symbol,  
  spotPrice: body.spotPrice,  
  expiry: body.expiry,                 // WEEKLY / MONTHLY  
  tradeType: body.tradeType,           // INTRADAY / POSITIONAL  
});  

if (optionsContext.status !== "READY") {  
  return res.json({  
    status: true,  
    context: optionsContext,  
  });  
}  

// -----------------------------  
// STEP 2: OPTIONS SAFETY CHECK (MANDATORY)  
// -----------------------------  
const safetyContext = getOptionsSafetyContext({  
  symbol: optionsContext.symbol,  
  expiryType: optionsContext.expiryType,  
  tradeContext: optionsContext.tradeContext,  
});  

if (safetyContext.safety?.allowTrade === false) {  
  return res.json({  
    status: true,  
    decision: {  
      status: "WAIT",  
      decision: "NO_TRADE",  
      uiSignal: "WAIT",  
      uiColor: "YELLOW",  
      uiText: "Wait",  
      reason: safetyContext.safety.reason || "Options safety restriction",  
      riskLevel: safetyContext.safety.riskLevel,  
    },  
  });  
}  

// -----------------------------  
// STEP 3: FINAL OPTIONS DECISION  
// -----------------------------  
const decision = decideOptionTrade({  
  ...optionsContext,  
  ema20: body.ema20,  
  ema50: body.ema50,  
  rsi: body.rsi,  
  vix: body.vix,  
});  

// -----------------------------  
// UI SIGNAL MAPPING (LOCKED RULE)  
// -----------------------------  
let uiSignal = "WAIT";  
let uiColor = "YELLOW";  
let uiText = "Wait";  

if (decision.decision === "OPTION_BUY_ALLOWED") {  
  uiSignal = "BUY";  
  uiColor = "GREEN";  
  uiText = "Buy";  
}  

if (decision.decision === "OPTION_SELL_ALLOWED") {  
  uiSignal = "SELL";  
  uiColor = "RED";  
  uiText = "Sell";  
}  

// -----------------------------  
// FINAL API RESPONSE (FROZEN FORMAT)  
// -----------------------------  
return res.json({  
  status: true,  
  context: optionsContext,  
  decision: {  
    ...decision,  
    uiSignal,  
    uiColor,  
    uiText,  
  },  
});

} catch (e) {
console.error("❌ Options API Error:", e.message);

return res.json({  
  status: false,  
  message: "Options processing error",  
});

}
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
getOptions,
};
