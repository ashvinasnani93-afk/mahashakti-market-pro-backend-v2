// ==========================================
// CHAT FORMATTER (TEXT + SYMBOLS ONLY)
// ==========================================

function formatSignalMessage(data = {}) {
  const {
    symbol,
    signal,
    momentumActive,
    institutionalTag,
  } = data;

  const signalMap = {
    BUY: "🟢",
    SELL: "🔴",
    WAIT: "🟡",
    STRONG_BUY: "🟢🔥",
    STRONG_SELL: "🔴🔥",
  };

  const signalIcon = signalMap[signal] || "🟡";

  // -----------------------------
  // CONTEXT TEXT (EXPLAIN ONLY)
  // -----------------------------
  const momentumText = momentumActive
    ? "⚡ Momentum Active"
    : "⏳ Momentum Weak";

  let institutionalText = "🏦 Institutions: Neutral";
  if (institutionalTag === "SUPPORTIVE") {
    institutionalText = "🏦 Institutions: Supportive";
  } else if (institutionalTag === "AGAINST") {
    institutionalText = "🏦 Institutions: Against";
  }

  // -----------------------------
  // CONFIDENCE TAG (SAFE)
  // -----------------------------
  let confidenceNote = "";
  if (
    signal !== "WAIT" &&
    (!momentumActive || institutionalTag === "NEUTRAL")
  ) {
    confidenceNote = "⚠️ Low confidence";
  }

  return {
    symbol,
    signal,
    display: `${signalIcon} ${signal}`,
    lines: [
      confidenceNote,
      momentumText,
      institutionalText,
    ].filter(Boolean),
  };
}

// ✅ THIS LINE WAS MISSING BEFORE
module.exports = formatSignalMessage;
