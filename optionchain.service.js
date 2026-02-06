// ==========================================
// OPTION CHAIN SERVICE - REAL ANGEL DATA - FIXED
// Builds option chain from Angel Master
// SUPPORTS: INDEX | STOCKS | COMMODITIES
// NO DUMMY - Pure Real Market Data
// ==========================================
const {
subscribeToToken
} = require("./services/angel/angelWebSocket.service");
const { getAllOptionSymbols } = require("./services/optionsMaster.service");
const { getLtpData } = require("./services/angel/angelApi.service");

/**

Build Option Chain from Angel One Master

Supports: NIFTY, BANKNIFTY, FINNIFTY, Stocks, Commodities
*/
async function buildOptionChainFromAngel(symbol, expiryDate = null) {
try {
console.log(📊 Building chain for ${symbol});

// Safe global cache
global.latestLTP = global.latestLTP || {};

// Get all option symbols from Angel master
const allOptions = await getAllOptionSymbols();

if (!allOptions || allOptions.length === 0) {
return {
status: false,
message: "Option master not loaded"
};
}

// Filter options for this symbol
const symbolOptions = allOptions.filter(opt =>
opt.name && opt.name.toUpperCase() === symbol.toUpperCase()
);

if (symbolOptions.length === 0) {
return {
status: false,
message: No options found for ${symbol}. Supported: NIFTY, BANKNIFTY, FINNIFTY, Stocks, Commodities
};
}

// Get available expiries
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

if (availableExpiries.length === 0) {
return {
status: false,
message: "No valid expiries found"
};
}

// Select expiry
const selectedExpiry = expiryDate || availableExpiries[0];
const expiryDateObj = new Date(selectedExpiry);

// Filter by expiry
const expiryOptions = symbolOptions.filter(opt => {
if (!opt.expiry) return false;
const optExpiry = new Date(opt.expiry);
return isSameDate(optExpiry, expiryDateObj);
});

if (expiryOptions.length === 0) {
return {
status: false,
message: No options for expiry ${selectedExpiry}
};
}

// Group by strike
const strikeMap = {};
expiryOptions.forEach(opt => {
const strike = Number(opt.strike);
if (!strike) return;

if (!strikeMap[strike]) {
strikeMap[strike] = { strike, CE: null, PE: null };
}

if (opt.type === "CE") {
strikeMap[strike].CE = {
token: opt.token,
symbol: opt.symbol,
strike: strike,
ltp: null
};
} else if (opt.type === "PE") {
strikeMap[strike].PE = {
token: opt.token,
symbol: opt.symbol,
strike: strike,
ltp: null
};
}
});

// Get strikes array
const strikes = Object.keys(strikeMap)
.map(Number)
.sort((a, b) => a - b);

// Get spot price
let spotPrice = null;

if (global.latestLTP[symbol]) {
spotPrice = global.latestLTP[symbol].ltp;
} else {
const ltpResult = await getLtpFromSymbol(symbol);
if (ltpResult) {
spotPrice = ltpResult;
}
}

// Calculate ATM
let atmStrike = null;
if (spotPrice && strikes.length > 0) {
atmStrike = strikes.reduce((prev, curr) =>
Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice)
? curr
: prev
);
}

// Get LTP for each option (from cache)
Object.keys(strikeMap).forEach(strike => {
const row = strikeMap[strike];

if (row.CE && row.CE.token) {


// 🔥 Subscribe if not already cached
if (!global.latestLTP[row.CE.token]) {
subscribeToToken(row.CE.token, 2); // 2 = NFO
}

const cached = global.latestLTP[row.CE.token];
if (cached) {
row.CE.ltp = cached.ltp;
}
}

// ===============================

// SUBSCRIBE + READ LTP (PE)
// ===============================
if (row.PE && row.PE.token) {

if (!global.latestLTP[row.PE.token]) {
subscribeToToken(row.PE.token, 2);
}

const cached = global.latestLTP[row.PE.token];
if (cached) {
row.PE.ltp = cached.ltp;
}
}
});

// Determine type  
const type = determineSymbolType(symbol);  

return {  
  status: true,  
  type,  
  expiry: selectedExpiry,  
  availableExpiries,  
  spot: spotPrice,  
  atmStrike,  
  totalStrikes: strikes.length,  
  chain: strikeMap  
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

/**

Determine symbol type

FIXED: Added COMMODITY support
*/
function determineSymbolType(symbol) {
const upperSymbol = symbol.toUpperCase();


// Index symbols
const indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];
if (indices.includes(upperSymbol)) {
return "INDEX";
}

// Commodity symbols (MCX)
const commodities = [
"GOLD", "GOLDM", "GOLDPETAL",
"SILVER", "SILVERM", "SILVERMICRO",
"CRUDE", "CRUDEOIL", "CRUDEOILM",
"NATURALGAS", "NATGAS", "NATURALG",
"COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"
];

if (commodities.includes(upperSymbol) || upperSymbol.includes("MCX")) {
return "COMMODITY";
}

return "STOCK";
}

/**

Check if two dates are same
*/
function isSameDate(d1, d2) {
return (
d1.getFullYear() === d2.getFullYear() &&
d1.getMonth() === d2.getMonth() &&
d1.getDate() === d2.getDate()
);
}


/**

Get LTP for symbol from Angel API

FIXED: Added commodity support
*/
async function getLtpFromSymbol(symbol) {
try {
const upperSymbol = symbol.toUpperCase();

// Index tokens
const symbolMap = {
NIFTY: { exchange: "NSE", token: "99926000" },
BANKNIFTY: { exchange: "NSE", token: "99926009" },
FINNIFTY: { exchange: "NSE", token: "99926037" },
MIDCPNIFTY: { exchange: "NSE", token: "99926074" }
};

if (symbolMap[upperSymbol]) {
const result = await getLtpData(
symbolMap[upperSymbol].exchange,
upperSymbol,
symbolMap[upperSymbol].token
);

if (result.success && result.data) {
return result.data.ltp || result.data.close;
}
}

// Fallback to cache (stocks / commodities)
if (global.latestLTP[upperSymbol]) {
return global.latestLTP[upperSymbol].ltp;
}

return null;


} catch (err) {
console.error("❌ getLtpFromSymbol error:", err.message);
return null;
}
}

module.exports = {
buildOptionChainFromAngel
};
