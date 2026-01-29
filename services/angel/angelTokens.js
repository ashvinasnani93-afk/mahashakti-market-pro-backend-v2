// ==========================================
// ANGEL OPTION TOKEN PROVIDER (LOCAL MASTER)
// MAHASHAKTI MARKET PRO – FINAL FIX
// ==========================================

let symbolMaster = null;

function setSymbolMaster(master) {
  symbolMaster = master;
  console.log("🔗 Local Option Symbol Master linked into Token Service");
}

// ENGINE CALLS THIS
async function fetchOptionTokens() {
  if (!symbolMaster || !Array.isArray(symbolMaster)) {
    throw new Error("Option Symbol Master not ready");
  }

  console.log("📡 Using LOCAL option token bundle:", symbolMaster.length);

  return symbolMaster.map(s => s.token).filter(Boolean);
}

module.exports = {
  fetchOptionTokens,
  setSymbolMaster
};
