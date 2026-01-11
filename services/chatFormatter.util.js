// ==========================================
// CHAT FORMATTER (TEXT + SYMBOLS ONLY)
// ROLE: Convert engine output to user-friendly chat
// ==========================================

function formatSignalMessage(data = {}) {
  const {
    symbol,
    signal,
    momentumActive,
    institutionalTag,
  } = data;

  // -----------------------------
  // SIGNAL SYMBOLS (LOCKED)
  // -----------------------------
  const signalMap = {
    BUY: "🟢",
    SELL: "🔴",
    WAIT: "🟡",
    STRONG_BUY: "🟢🔥",
    STRONG_SELL: "🔴🔥",
  };

  const signalIcon = signalMap[signal] || "🟡";

  // -----------------------------
  // MOMENTUM TEXT
  // -----------------------------
  const momentumText = momentumActive
    ? "⚡ Momentum Active"
    : "⏳ No momentum";

  // -----------------------------
  // INSTITUTIONAL CONTEXT
  // -----------------------------
  let institutionalText = "🏦 Institutions: Neutral";
  if (institutionalTag === "SUPPORTIVE") {
    institutionalText = "🏦 Institutions: Supportive";
  } else if (institutionalTag === "AGAINST") {
    institutionalText = "🏦 Institutions: Against";
  }

  // -----------------------------
  // FINAL CHAT MESSAGE
  // -----------------------------
  return {
    symbol,
    signal,
    display: `${signalIcon} ${signal}`,
    lines: [
      momentumText,
      institutionalText,
    ],
  };
}

// ✅ THIS IS THE MOST IMPORTANT LINE
module.exports = {
  formatSignalMessage,
};
