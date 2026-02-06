// ==========================================
// OPTION CHAIN SERVICE - PRODUCTION OPTIMIZED
// REAL ANGEL DATA - INSTANT LTP + WS STREAM
// SUPPORTS: INDEX | STOCK | COMMODITY
// ==========================================

const { subscribeToToken } = require("./services/angel/angelWebSocket.service");
const { getAllOptionSymbols } = require("./services/optionsMaster.service");
const { getLtpData } = require("./services/angel/angelApi.service");

const ATM_RANGE = 5; // ATM ± 5 strikes = 11 total strikes

async function buildOptionChainFromAngel(symbol, expiryDate = null) {
  try {
    console.log(`📊 Building chain for ${symbol}`);

    global.latestLTP = global.latestLTP || {};

    const allOptions = await getAllOptionSymbols();
    if (!allOptions || allOptions.length === 0) {
      return { status: false, message: "Option master not loaded" };
    }

    const symbolOptions = allOptions.filter(
      opt => opt.name && opt.name.toUpperCase() === symbol.toUpperCase()
    );

    if (!symbolOptions.length) {
      return { status: false, message: `No options found for ${symbol}` };
    }

    // --------- EXPIRY ----------
    const expirySet = new Set();
    symbolOptions.forEach(opt => {
      if (opt.expiry) {
        const d = new Date(opt.expiry);
        if (!isNaN(d.getTime())) {
          expirySet.add(d.toISOString().slice(0, 10));
        }
      }
    });

    const availableExpiries = Array.from(expirySet).sort();
    const selectedExpiry = expiryDate || availableExpiries[0];
    const expiryObj = new Date(selectedExpiry);

    const expiryOptions = symbolOptions.filter(opt => {
      if (!opt.expiry) return false;
      const d = new Date(opt.expiry);
      return isSameDate(d, expiryObj);
    });

    if (!expiryOptions.length) {
      return { status: false, message: `No options for expiry ${selectedExpiry}` };
    }

    // --------- STRIKE MAP ----------
    const strikeMap = {};
    expiryOptions.forEach(opt => {
      const strike = Number(opt.strike);
      if (!strike) return;

      if (!strikeMap[strike]) {
        strikeMap[strike] = { strike, CE: null, PE: null };
      }

      const row = strikeMap[strike];

      if (opt.type === "CE") {
        row.CE = {
          token: opt.token,
          symbol: opt.symbol,
          strike,
          ltp: null
        };
      }

      if (opt.type === "PE") {
        row.PE = {
          token: opt.token,
          symbol: opt.symbol,
          strike,
          ltp: null
        };
      }
    });

    const strikes = Object.keys(strikeMap).map(Number).sort((a, b) => a - b);

    // --------- SPOT ----------
    const spotPrice = await getLtpFromSymbol(symbol);

    let atmStrike = null;
    if (spotPrice && strikes.length) {
      atmStrike = strikes.reduce((prev, curr) =>
        Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice)
          ? curr
          : prev
      );
    }

    // --------- ATM RANGE FILTER ----------
    let filteredStrikes = strikes;

    if (atmStrike) {
      const atmIndex = strikes.indexOf(atmStrike);
      const start = Math.max(0, atmIndex - ATM_RANGE);
      const end = Math.min(strikes.length - 1, atmIndex + ATM_RANGE);
      filteredStrikes = strikes.slice(start, end + 1);
    }

    // --------- BATCH LTP FETCH ----------
    const tokensToFetch = [];

    filteredStrikes.forEach(strike => {
      const row = strikeMap[strike];
      if (row.CE?.token) tokensToFetch.push({ token: row.CE.token, exchange: "NFO" });
      if (row.PE?.token) tokensToFetch.push({ token: row.PE.token, exchange: "NFO" });
    });

    await fetchBatchLTP(tokensToFetch);

    // --------- FILL LTP + SUBSCRIBE ----------
    filteredStrikes.forEach(strike => {
      const row = strikeMap[strike];

      if (row.CE?.token) {
        const cached = global.latestLTP[row.CE.token];
        if (cached) row.CE.ltp = cached.ltp;
        subscribeToToken(row.CE.token, 2);
      }

      if (row.PE?.token) {
        const cached = global.latestLTP[row.PE.token];
        if (cached) row.PE.ltp = cached.ltp;
        subscribeToToken(row.PE.token, 2);
      }
    });

    return {
      status: true,
      type: determineSymbolType(symbol),
      expiry: selectedExpiry,
      availableExpiries,
      spot: spotPrice,
      atmStrike,
      totalStrikes: filteredStrikes.length,
      chain: Object.fromEntries(
        filteredStrikes.map(strike => [strike, strikeMap[strike]])
      )
    };

  } catch (err) {
    console.error("❌ buildOptionChainFromAngel error:", err.message);
    return {
      status: false,
      message: "Option chain build failed",
      error: err.message
    };
  }
}

// ==========================================
// BATCH LTP FETCH (SAFE - MAX 50 LIMIT)
// ==========================================
async function fetchBatchLTP(tokens) {
  if (!tokens.length) return;

  const BATCH_SIZE = 25;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async item => {
        try {
          const result = await getLtpData(
            item.exchange,
            item.token,
            item.token
          );

          if (result.success && result.data) {
            global.latestLTP[item.token] = {
              ltp: result.data.ltp || result.data.close,
              timestamp: Date.now()
            };
          }
        } catch (e) {
          console.log("LTP fetch error:", e.message);
        }
      })
    );
  }
}

// ==========================================
// SYMBOL TYPE
// ==========================================
function determineSymbolType(symbol) {
  const upper = symbol.toUpperCase();

  const indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];
  if (indices.includes(upper)) return "INDEX";

  const commodities = [
    "GOLD", "SILVER", "CRUDE", "CRUDEOIL",
    "NATURALGAS", "COPPER", "ZINC", "LEAD",
    "NICKEL", "ALUMINIUM"
  ];

  if (commodities.includes(upper) || upper.includes("MCX"))
    return "COMMODITY";

  return "STOCK";
}

// ==========================================
// DATE MATCH
// ==========================================
function isSameDate(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// ==========================================
// GET SPOT
// ==========================================
async function getLtpFromSymbol(symbol) {
  try {
    const map = {
      NIFTY: { exchange: "NSE", token: "99926000" },
      BANKNIFTY: { exchange: "NSE", token: "99926009" },
      FINNIFTY: { exchange: "NSE", token: "99926037" },
      MIDCPNIFTY: { exchange: "NSE", token: "99926074" }
    };

    const upper = symbol.toUpperCase();

    if (map[upper]) {
      const result = await getLtpData(
        map[upper].exchange,
        upper,
        map[upper].token
      );

      if (result.success && result.data) {
        return result.data.ltp || result.data.close;
      }
    }

    return global.latestLTP[upper]?.ltp || null;

  } catch {
    return null;
  }
}

module.exports = {
  buildOptionChainFromAngel
};
