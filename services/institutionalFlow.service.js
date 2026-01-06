// ==========================================
// INSTITUTIONAL FLOW SERVICE (FII / DII)
// ROLE: CONTEXT ONLY (HAWAA)
// NO BUY / SELL GENERATION
// ==========================================

/**
 * analyzeInstitutionalFlow
 * @param {Object} data
 * @returns {Object}
 *
 * Required:
 * - fiiNet (number)  // +ve = buying, -ve = selling
 * - diiNet (number)  // +ve = buying, -ve = selling
 */
function analyzeInstitutionalFlow(data = {}) {
  const fiiNet = Number(data.fiiNet || 0);
  const diiNet = Number(data.diiNet || 0);

  // -----------------------------
  // DEFAULT RESPONSE
  // -----------------------------
  let flow = "MIXED";
  let note = "Institutional flow mixed";

  // -----------------------------
  // BOTH SUPPORTIVE
  // -----------------------------
  if (fiiNet > 0 && diiNet > 0) {
    flow = "SUPPORTIVE";
    note = "FII & DII both buying";
  }

  // -----------------------------
  // BOTH AGAINST
  // -----------------------------
  else if (fiiNet < 0 && diiNet < 0) {
    flow = "AGAINST";
    note = "FII & DII both selling";
  }

  // -----------------------------
  // CONFLICT
  // -----------------------------
  else if (fiiNet !== 0 || diiNet !== 0) {
    flow = "MIXED";
    note = "FII & DII conflict";
  }

  return {
    flow,   // SUPPORTIVE | AGAINST | MIXED
    note,   // text (internal use)
  };
}

module.exports = {
  analyzeInstitutionalFlow,
};
