// ==========================================
// INSTITUTIONAL FLOW API (FII / DII)
// ROLE: Context / Confidence Tag ONLY
// ==========================================

const express = require("express");
const router = express.Router();

const { analyzeInstitutionalFlow } = require("./institutionalFlow.service");

/**
 * POST /institutional/flow
 * Body:
 * - fiiNet (number)
 * - diiNet (number)
 */
router.post("/flow", (req, res) => {
  try {
    const result = analyzeInstitutionalFlow(req.body || {});
    return res.json({
      status: "OK",
      data: result, // SUPPORTIVE | AGAINST | MIXED
    });
  } catch (e) {
    return res.status(500).json({
      status: "ERROR",
      message: "Institutional flow analysis failed",
    });
  }
});

module.exports = router;
