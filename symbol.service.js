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
      console.log("⚠️ setAllSymbols called with invalid data");
      return;
    }

    symbolStore = symbols;
    console.log("🧠 SYMBOL SERVICE: Symbols registered:", symbols.length);
  } catch (e) {
    console.error("❌ setAllSymbols failed:", e.message);
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
    console.log("📦 SYMBOL SERVICE: Option symbols registered:", Object.keys(map).length);
  } catch (e) {
    console.error("❌ setOptionSymbolMaster failed:", e.message);
  }
}

// ==============================
// GET SYMBOLS (ENGINE USE)
// ==============================
function getAllSymbols() {
  try {
    const optionKeys = Object.keys(optionStore || {});

    if (optionKeys.length > 0) {
      return optionKeys;
    }

    if (!Array.isArray(symbolStore) || symbolStore.length === 0) {
      console.log("⚠️ SYMBOL SERVICE: No symbols ready yet");
      return [];
    }

    return symbolStore;
  } catch (e) {
    console.error("❌ getAllSymbols failed:", e.message);
    return [];
  }
}

module.exports = {
  setAllSymbols,
  setOptionSymbolMaster,
  getAllSymbols
};
