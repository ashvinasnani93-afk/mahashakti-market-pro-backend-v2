// ==========================================
// COMMODITY SPOT FIX - PATCH ONLY
// Add this BEFORE ATM calculation in buildOptionChainFromAngel()
// Location: optionchain.service.js
// ==========================================

// FIND THIS SECTION (around line 90-100):
// ----------------------------------------
// Get spot price
// let spotPrice = null;
//
// if (global.latestLTP[symbol]) {
//   spotPrice = global.latestLTP[symbol].ltp;
// } else {
//   const ltpResult = await getLtpFromSymbol(symbol);
//   if (ltpResult) {
//     spotPrice = ltpResult;
//   }
// }
// ----------------------------------------

// REPLACE WITH THIS:
// ----------------------------------------

    // ==========================================
    // SPOT PRICE FETCH - WITH COMMODITY FIX
    // ==========================================
    let spotPrice = null;
    const symbolType = determineSymbolType(symbol);

    // Check cache first
    if (global.latestLTP[symbol]) {
      spotPrice = global.latestLTP[symbol].ltp;
      console.log(`📊 [SPOT] Cache hit: ${symbol} = ${spotPrice}`);
    }
    
    // COMMODITY SPOT FIX: Subscribe MCX underlying token
    if (!spotPrice && symbolType === "COMMODITY") {
      console.log(`📊 [SPOT] Commodity detected: ${symbol}`);
      
      try {
        // Import at top of file if not already:
        // const { getCommodityToken, loadCommodityMaster } = require("./services/angel/angelApi.service");
        
        await loadCommodityMaster();
        const commodityInfo = getCommodityToken(symbol);
        
        if (commodityInfo && commodityInfo.token) {
          const underlyingToken = commodityInfo.token;
          console.log(`📊 [SPOT] MCX underlying: ${commodityInfo.symbol} (token: ${underlyingToken})`);
          
          // Subscribe underlying MCX token (mode 1 = LTP)
          if (!global.subscribedTokens) {
            global.subscribedTokens = new Set();
          }
          
          if (!global.subscribedTokens.has(underlyingToken)) {
            subscribeToToken(underlyingToken, 1); // Mode 1 for MCX underlying
            global.subscribedTokens.add(underlyingToken);
            console.log(`📊 [SPOT] Subscribed MCX underlying: ${underlyingToken}`);
          }
          
          // Check cache after subscription
          if (global.latestLTP[underlyingToken]) {
            spotPrice = global.latestLTP[underlyingToken].ltp;
            console.log(`📊 [SPOT] MCX from cache: ${spotPrice}`);
          }
          
          // Fallback: Direct API call
          if (!spotPrice) {
            const mcxResult = await getLtpData("MCX", commodityInfo.symbol, underlyingToken);
            if (mcxResult && mcxResult.success && mcxResult.data) {
              spotPrice = mcxResult.data.ltp || mcxResult.data.close;
              console.log(`📊 [SPOT] MCX from API: ${spotPrice}`);
            }
          }
        }
      } catch (err) {
        console.error(`📊 [SPOT] Commodity error: ${err.message}`);
      }
    }
    
    // EXISTING: Non-commodity spot fetch (unchanged)
    if (!spotPrice) {
      const ltpResult = await getLtpFromSymbol(symbol);
      if (ltpResult) {
        spotPrice = ltpResult;
      }
    }

// ----------------------------------------
// END OF PATCH
// ==========================================

// ALSO ADD THIS IMPORT AT TOP OF FILE (if not present):
// ----------------------------------------
// const { getCommodityToken, loadCommodityMaster, getLtpData } = require("./services/angel/angelApi.service");
// ----------------------------------------
