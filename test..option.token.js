// ==========================================
// TEST FILE
// OPTION SYMBOL → TOKEN CHECK
// ==========================================

const {
  loadOptionSymbolMaster,
  getOptionToken,
} = require("./token.service");

const {
  formatOptionSymbol,
} = require("./symbol.service");

// ===============================
// TEST FLOW
// ===============================
async function testOptionToken() {
  console.log("🧪 TEST STARTED");

  // 1️⃣ Load Angel OPTION symbol master
  await loadOptionSymbolMaster();

  // 2️⃣ Create a test option symbol
  const optionSymbol = formatOptionSymbol({
    index: "NIFTY",
    expiryDate: new Date(2025, 0, 30), // 30 JAN 2025
    strike: 24500,
    type: "CE",
  });

  console.log("📌 Generated Option Symbol:", optionSymbol);

  // 3️⃣ Get token
  const tokenData = getOptionToken(optionSymbol);

  if (!tokenData) {
    console.log("❌ TOKEN NOT FOUND");
  } else {
    console.log("✅ TOKEN FOUND");
    console.log("🔑 Token:", tokenData.token);
    console.log("🏦 ExchangeType:", tokenData.exchangeType);
  }
}

// ===============================
// RUN TEST
// ===============================
testOptionToken();
