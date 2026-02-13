// ==========================================
// ANGEL ONE INSTRUMENT MASTER LOADER
// Dynamic Lot Size + Token Mapping
// Based on Official Angel OpenAPIScripMaster
// ==========================================

const axios = require("axios");

const MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

let masterData = [];
let instrumentMap = new Map();
let fnoMap = new Map();
let indexMap = new Map();
let commodityMap = new Map();

async function loadMaster() {
  try {
    console.log("[MASTER] Downloading Angel Instrument Master...");

    const response = await axios.get(MASTER_URL, {
      timeout: 20000
    });

    masterData = response.data;

    buildMaps();

    console.log(
      `[MASTER] Loaded ${masterData.length} instruments successfully`
    );

    return true;
  } catch (error) {
    console.error("[MASTER] Failed to load master:", error.message);
    return false;
  }
}

function buildMaps() {
  instrumentMap.clear();
  fnoMap.clear();
  indexMap.clear();
  commodityMap.clear();

  masterData.forEach((inst) => {
    const {
      symbol,
      name,
      exch_seg,
      instrumenttype,
      lotsize,
      token,
      expiry
    } = inst;

    const obj = {
      symbol,
      name,
      exchange: exch_seg,
      instrumentType: instrumenttype,
      lotSize: Number(lotsize),
      token,
      expiry
    };

    instrumentMap.set(symbol, obj);

    // INDEX
    if (instrumenttype === "INDEX") {
      indexMap.set(symbol, obj);
    }

    // F&O (Equity + Index)
    if (
      instrumenttype === "FUTSTK" ||
      instrumenttype === "FUTIDX" ||
      instrumenttype === "OPTSTK" ||
      instrumenttype === "OPTIDX"
    ) {
      fnoMap.set(symbol, obj);
    }

    // Commodities
    if (exch_seg === "MCX") {
      commodityMap.set(symbol, obj);
    }
  });
}

// ==========================================
// GETTERS
// ==========================================

function getBySymbol(symbol) {
  return instrumentMap.get(symbol);
}

function getLotSize(symbol) {
  const inst = instrumentMap.get(symbol);
  return inst ? inst.lotSize : null;
}

function getFNO() {
  return Array.from(fnoMap.values());
}

function getIndices() {
  return Array.from(indexMap.values());
}

function getCommodities() {
  return Array.from(commodityMap.values());
}

function getAll() {
  return Array.from(instrumentMap.values());
}

module.exports = {
  loadMaster,
  getBySymbol,
  getLotSize,
  getFNO,
  getIndices,
  getCommodities,
  getAll
};
