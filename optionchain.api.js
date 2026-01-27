// ==========================================  
// GET OPTION CHAIN  
// /option-chain?index=BANKNIFTY&expiry=2025-01-30  
// OR  
// /option-chain?stock=RELIANCE&expiry=2025-01-30  
// ==========================================  
async function getOptionChain(req, res) {  
  try {  
    const { index, stock, expiry } = req.query;  
  
    // -------------------------------  
    // BASIC VALIDATION  
    // -------------------------------  
    if ((!index && !stock) || !expiry) {  
      return res.json({  
        status: false,  
        message: "index/stock and expiry required",  
      });  
    }  
  
    const symbol = (index || stock).toUpperCase();  
    const expiryDate = new Date(expiry);  
  
    if (isNaN(expiryDate.getTime())) {  
      return res.json({  
        status: false,  
        message: "invalid expiry date",  
      });  
    }  
  
    // Check if it's index or stock  
    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(symbol);  
      
    if (!isIndex && !stock) {  
      return res.json({  
        status: false,  
        message: "For stocks, use ?stock=SYMBOL&expiry=DATE",  
      });  
    }  
  
    // -------------------------------  
    // STRIKES (ANGEL – SOURCE OF TRUTH)  
    // -------------------------------  
    const strikes = await getValidStrikes({  
      index: isIndex ? symbol : null,  
      stock: !isIndex ? symbol : null,  
      expiryDate  
    });  
  
    if (!Array.isArray(strikes) || strikes.length === 0) {  
      return res.json({  
        status: false,  
        message: `no valid strikes from Angel for ${symbol}`,  
      });  
    }  
  
    // -------------------------------  
    // BUILD OPTION CHAIN  
    // (NO SIGNAL, CONTEXT ONLY)  
    // -------------------------------  
    const rawChain = buildOptionChain({  
      index: isIndex ? symbol : null,  
      stock: !isIndex ? symbol : null,  
      expiryDate,  
      strikes,  
    });  
  
    // -------------------------------  
    // SYMBOL CONTEXT MAPPING (LOCKED)  
    // 🟢 Buyer-favourable  
    // 🔴 Seller-favourable  
    // 🟡 No-trade / wait  
    // -------------------------------  
    const chain = {};  
  
    Object.keys(rawChain).forEach((strike) => {  
      const row = rawChain[strike];  
  
      chain[strike] = {  
        strike: Number(strike),  
  
        CE: {  
          ...row.CE,  
          contextSymbol: row.CE?.buyerBias  
            ? "🟢"  
            : row.CE?.sellerBias  
            ? "🔴"  
            : "🟡",  
        },  
  
        PE: {  
          ...row.PE,  
          contextSymbol: row.PE?.buyerBias  
            ? "🟢"  
            : row.PE?.sellerBias  
            ? "🔴"  
            : "🟡",  
        },  
      };  
    });  
  
    // -------------------------------  
    // FINAL RESPONSE (FRONTEND READY)  
    // -------------------------------  
    return res.json({  
      status: true,  
      symbol: symbol,  
      type: isIndex ? 'INDEX' : 'STOCK',  
      expiry: expiryDate.toISOString().slice(0, 10),  
      legend: {  
        "🟢": "Buyer-favourable zone",  
        "🔴": "Seller-favourable zone",  
        "🟡": "No-trade / wait zone",  
      },  
      totalStrikes: Object.keys(chain).length,  
      chain,  
      note:  
        "Context-only option chain. Symbols indicate buyer/seller pressure. No execution or recommendation.",  
    });  
  } catch (e) {  
    console.error("❌ OptionChain API Error:", e);  
    return res.json({  
      status: false,  
      message: "option chain internal error",  
    });  
  }  
}

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  getOptionChain,
};
