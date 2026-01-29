// ==========================================
// SYMBOL MASTER SERVICE — FINAL (LOCKED)
// MAHASHAKTI MARKET PRO
// SINGLE SOURCE OF TRUTH
// ==========================================

let symbolStore = [];

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

// ==============================
// GET SYMBOLS (ENGINE USE)
// ==============================
function getAllSymbols() {
  try {
    if (!Array.isArray(symbolStore) || symbolStore.length === 0) {
      console.log("⚠️ SYMBOL SERVICE: Symbol Master not ready yet");
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
  getAllSymbols
};
