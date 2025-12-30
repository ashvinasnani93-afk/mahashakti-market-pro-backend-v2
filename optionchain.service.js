// ==========================================
// OPTION CHAIN SERVICE – FINAL (A3.0)
// Angel Validated | No Fake Strikes
// ==========================================

const { formatOptionSymbol, isMonthlyExpiry } = require("./symbol.service");
const { getOptionToken } = require("./token.service");

// ==========================================
// BUILD OPTION CHAIN (ANGEL SOURCE OF TRUTH)
// ==========================================
function buildOptionChain({
  index,        // NIFTY / BANKNIFTY
  expiryDate,   // JS Date
  strikes = [], // strikes from strike.service (Angel validated)
}) {
  const chain = {};

  const expiryType = isMonthlyExpiry(expiryDate)
    ? "MONTHLY"
    : "WEEKLY";

  strikes.forEach((strike) => {
    // ===============================
    // FORMAT SYMBOLS
    // ===============================
    const ceSymbol = formatOptionSymbol({
      index,
      expiryDate,
      strike,
      type: "CE",
      expiryType,
    });

    const peSymbol = formatOptionSymbol({
      index,
      expiryDate,
      strike,
      type: "PE",
      expiryType,
    });

    // ===============================
    // FETCH TOKENS FROM ANGEL MASTER
    // ===============================
    const ceToken = getOptionToken(ceSymbol);
    const peToken = getOptionToken(peSymbol);

    // 🚫 HARD FILTER
    // Angel ke paas dono nahi → strike exist hi nahi karta
    if (!ceToken && !peToken) {
      return;
    }

    // ===============================
    // FINAL STRIKE OBJECT
    // ===============================
    chain[strike] = {
      strike,

      CE: ceToken
        ? {
            symbol: ceSymbol,
            token: ceToken.token,
            exchangeType: ceToken.exchangeType, // NFO
          }
        : null,

      PE: peToken
        ? {
            symbol: peSymbol,
            token: peToken.token,
            exchangeType: peToken.exchangeType, // NFO
          }
        : null,
    };
  });

  return chain;
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  buildOptionChain,
};
