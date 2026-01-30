// ==========================================
// SYMBOL MASTER SERVICE — FINAL (LOCKED)
// MAHASHAKTI MARKET PRO
// SINGLE SOURCE OF TRUTH
// ==========================================

let symbolStore = [];
let optionStore = {};

// ==============================
// SET SYMBOLS (SERVER USE)
// ==============================
function setAllSymbols(symbols) {
  try {
    if (!Array.isArray(symbols)) {
      console.log("⚠️ SYMBOL SERVICE: setAllSymbols called with invalid data");
      return;
    }

    symbolStore = symbols;
    console.log("🧠 SYMBOL SERVICE: Stock symbols registered:", symbols.length);
  } catch (e) {
    console.error("❌ SYMBOL SERVICE: setAllSymbols failed:", e.message);
  }
}

// ============================
// SET OPTION SYMBOL MASTER
// ============================
function setOptionSymbolMaster(map) {
  try {
    if (!map || typeof map !== "object") {
      console.log("⚠️ SYMBOL SERVICE: Option master invalid");
      return;
    }

    optionStore = map;
    console.log(
      "📦 SYMBOL SERVICE: Option symbols registered:",
      Object.keys(map).length
    );
  } catch (e) {
    console.error(
      "❌ SYMBOL SERVICE: setOptionSymbolMaster failed:",
      e.message
    );
  }
}

// ==============================
// GET SYMBOLS (ENGINE USE)
// ==============================
function getAllSymbols() {
  try {
    // PRIORITY = OPTION TOKENS
    if (
      optionStore &&
      typeof optionStore === "object" &&
      Object.keys(optionStore).length > 0
    ) {
      const tokens = Object.values(optionStore);
      console.log("📤 SYMBOL SERVICE: Returning OPTION TOKENS:", tokens.length);
      return tokens;
    }

    // FALLBACK = STOCK SYMBOLS
    if (!Array.isArray(symbolStore) || symbolStore.length === 0) {
      console.log("⚠️ SYMBOL SERVICE: No symbols ready yet");
      return [];
    }

    console.log(
      "📤 SYMBOL SERVICE: Returning STOCK SYMBOLS:",
      symbolStore.length
    );
    return symbolStore;
  } catch (e) {
    console.error("❌ SYMBOL SERVICE: getAllSymbols failed:", e.message);
    return [];
  }
}

module.exports = {
  setAllSymbols,
  setOptionSymbolMaster,
  getAllSymbols
};
