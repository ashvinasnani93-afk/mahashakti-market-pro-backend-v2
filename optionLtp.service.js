// ==========================================
// OPTION LTP SERVICE (NFO WebSocket)
// ==========================================

if (!global.latestLTP) {
  global.latestLTP = {};
}

// ===============================
// UPDATE LTP FROM WS
// ===============================
function updateOptionLTP(token, ltp) {
  if (!global.latestLTP) {
    global.latestLTP = {};
  }

  global.latestLTP[token] = {
    ltp: Number(ltp),
    timestamp: Date.now()
  };
}

// ===============================
// GET LTP
// ===============================
function getOptionLTP(token) {
  if (!global.latestLTP) return null;

  const data = global.latestLTP[token];
  return data ? data.ltp : null;
}

// ===============================
// EXPORT
// ===============================
module.exports = {
  updateOptionLTP,
  getOptionLTP,
};
