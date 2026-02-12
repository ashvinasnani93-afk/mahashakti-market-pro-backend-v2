// ==========================================
// WS FOCUS MANAGER - INSTITUTIONAL GRADE
// MAHASHAKTI MARKET PRO
// Smart subscription: Max 120 tokens, Dynamic rotation
// ==========================================

const { subscribeTokens, unsubscribeTokens, getSubscriptionCount } = require("./angel/angelWebSocket.service");
const { getTopCandidates } = require("./marketScanner.service");
const { getTopNForWebSocket } = require("./rankingEngine.service");

// ==========================================
// CONFIG
// ==========================================
const MAX_LIVE_TOKENS = 120;
const ROTATION_INTERVAL = 60000; // 60 seconds
const PERFORMANCE_CHECK_INTERVAL = 30000; // 30 seconds
const MIN_PERFORMANCE_SCORE = 0.5; // Minimum score to keep subscription

let focusManagerActive = false;
let rotationTimer = null;
let performanceCheckTimer = null;

// ==========================================
// ACTIVE SUBSCRIPTIONS TRACKING
// ==========================================
const activeSubscriptions = new Map(); // token -> { symbol, score, subscribedAt, lastUpdate, performance }

// ==========================================
// START FOCUS MANAGER
// ==========================================
function startFocusManager() {
  if (focusManagerActive) {
    console.log("[FOCUS_WS] Already running");
    return { success: false, message: "Focus manager already active" };
  }

  focusManagerActive = true;
  console.log("[FOCUS_WS] 🎯 Starting Smart WebSocket Focus Manager");

  // Initial subscription
  performRotation();

  // Schedule periodic rotation
  rotationTimer = setInterval(() => {
    performRotation();
  }, ROTATION_INTERVAL);

  // Schedule performance checks
  performanceCheckTimer = setInterval(() => {
    checkPerformance();
  }, PERFORMANCE_CHECK_INTERVAL);

  return {
    success: true,
    message: "Focus manager started",
    maxTokens: MAX_LIVE_TOKENS,
    rotationInterval: ROTATION_INTERVAL
  };
}

// ==========================================
// STOP FOCUS MANAGER
// ==========================================
function stopFocusManager() {
  if (!focusManagerActive) {
    return { success: false, message: "Focus manager not running" };
  }

  focusManagerActive = false;

  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }

  if (performanceCheckTimer) {
    clearInterval(performanceCheckTimer);
    performanceCheckTimer = null;
  }

  // Unsubscribe all focus tokens
  const tokensToUnsubscribe = Array.from(activeSubscriptions.keys()).map(token => ({ token }));
  if (tokensToUnsubscribe.length > 0) {
    unsubscribeTokens(tokensToUnsubscribe, "focus-shutdown");
  }

  activeSubscriptions.clear();

  console.log("[FOCUS_WS] 🛑 Focus manager stopped");

  return { success: true, message: "Focus manager stopped" };
}

// ==========================================
// PERFORM ROTATION - CORE LOGIC
// ==========================================
async function performRotation() {
  try {
    console.log("[FOCUS_WS] 🔄 Performing rotation...");

    // Get top candidates from scanner
    const scannerCandidates = getTopCandidates(150); // Get more than we need

    if (!scannerCandidates || scannerCandidates.length === 0) {
      console.log("[FOCUS_WS] ⚠️ No candidates from scanner");
      return;
    }

    console.log(`[FOCUS_WS] Scanner provided ${scannerCandidates.length} candidates`);

    // Build priority list
    const priorityList = buildPriorityList(scannerCandidates);

    console.log(`[FOCUS_WS] Priority list built: ${priorityList.length} stocks`);

    // Determine which tokens to subscribe/unsubscribe
    const { toSubscribe, toUnsubscribe } = determineRotation(priorityList);

    // Unsubscribe low-performing tokens
    if (toUnsubscribe.length > 0) {
      console.log(`[FOCUS_WS] Unsubscribing ${toUnsubscribe.length} tokens`);
      unsubscribeTokens(toUnsubscribe, "focus-rotation");
      
      // Remove from tracking
      toUnsubscribe.forEach(t => {
        activeSubscriptions.delete(t.token);
      });
    }

    // Subscribe to new high-priority tokens
    if (toSubscribe.length > 0) {
      console.log(`[FOCUS_WS] Subscribing ${toSubscribe.length} new tokens`);
      subscribeTokens(toSubscribe, "focus-rotation");
      
      // Add to tracking
      toSubscribe.forEach(t => {
        activeSubscriptions.set(t.token, {
          symbol: t.symbol,
          exchange: t.exchange,
          score: t.score || 0,
          subscribedAt: Date.now(),
          lastUpdate: Date.now(),
          performance: 1.0,
          reason: t.reason || "scanner"
        });
      });
    }

    console.log(`[FOCUS_WS] ✅ Rotation complete. Active: ${activeSubscriptions.size}/${MAX_LIVE_TOKENS}`);

  } catch (error) {
    console.error("[FOCUS_WS] ❌ Rotation error:", error.message);
  }
}

// ==========================================
// BUILD PRIORITY LIST
// ==========================================
function buildPriorityList(candidates) {
  // Score each candidate
  const scored = candidates.map(candidate => {
    let priorityScore = 0;

    // Base score from scanner/ranking
    if (candidate.score) {
      priorityScore += candidate.score;
    }

    // Boost based on reason
    if (candidate.reason) {
      if (candidate.reason.includes("Breakout")) priorityScore += 20;
      if (candidate.reason.includes("Volume")) priorityScore += 15;
      if (candidate.reason.includes("Explosion")) priorityScore += 18;
      if (candidate.reason.includes("Momentum")) priorityScore += 12;
      if (candidate.reason.includes("Rank")) priorityScore += 10;
    }

    // Boost if already subscribed (continuity)
    if (activeSubscriptions.has(candidate.token)) {
      const existing = activeSubscriptions.get(candidate.token);
      priorityScore += existing.performance * 5; // Boost based on performance
    }

    return {
      ...candidate,
      priorityScore
    };
  });

  // Sort by priority score (descending)
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Take top N
  return scored.slice(0, MAX_LIVE_TOKENS);
}

// ==========================================
// DETERMINE ROTATION
// ==========================================
function determineRotation(priorityList) {
  const toSubscribe = [];
  const toUnsubscribe = [];

  const currentTokens = new Set(activeSubscriptions.keys());
  const newTokens = new Set(priorityList.map(c => c.token));

  // Find tokens to unsubscribe (in current but not in new priority list)
  currentTokens.forEach(token => {
    if (!newTokens.has(token)) {
      const sub = activeSubscriptions.get(token);
      toUnsubscribe.push({
        token,
        symbol: sub.symbol,
        exchangeType: sub.exchange === "NSE" ? 1 : sub.exchange === "BSE" ? 2 : 5
      });
    }
  });

  // Find tokens to subscribe (in new priority but not currently subscribed)
  priorityList.forEach(candidate => {
    if (!currentTokens.has(candidate.token)) {
      toSubscribe.push({
        token: candidate.token,
        symbol: candidate.symbol,
        exchange: candidate.exchange,
        exchangeType: candidate.exchange === "NSE" ? 1 : candidate.exchange === "BSE" ? 2 : 5,
        mode: 3, // Full mode
        score: candidate.priorityScore,
        reason: candidate.reason
      });
    }
  });

  // Limit subscriptions to available slots
  const availableSlots = MAX_LIVE_TOKENS - (activeSubscriptions.size - toUnsubscribe.length);
  if (toSubscribe.length > availableSlots) {
    toSubscribe.splice(availableSlots);
  }

  return { toSubscribe, toUnsubscribe };
}

// ==========================================
// CHECK PERFORMANCE - Remove slow movers
// ==========================================
function checkPerformance() {
  if (!focusManagerActive) return;

  console.log("[FOCUS_WS] 📊 Checking performance...");

  const now = Date.now();
  const lowPerformers = [];

  activeSubscriptions.forEach((data, token) => {
    // Calculate time subscribed
    const timeSubscribed = now - data.subscribedAt;

    // Check if data is stale
    const timeSinceUpdate = now - data.lastUpdate;

    // Performance calculation (simplified)
    let performance = data.performance || 1.0;

    // Degrade performance if no updates
    if (timeSinceUpdate > 60000) {
      performance *= 0.9;
    }

    // Update performance
    data.performance = performance;
    activeSubscriptions.set(token, data);

    // Mark for removal if performance too low
    if (performance < MIN_PERFORMANCE_SCORE && timeSubscribed > 120000) {
      lowPerformers.push({
        token,
        symbol: data.symbol,
        performance,
        exchangeType: data.exchange === "NSE" ? 1 : data.exchange === "BSE" ? 2 : 5
      });
    }
  });

  // Remove low performers
  if (lowPerformers.length > 0) {
    console.log(`[FOCUS_WS] Removing ${lowPerformers.length} low performers`);
    unsubscribeTokens(lowPerformers, "performance-cleanup");
    
    lowPerformers.forEach(p => {
      activeSubscriptions.delete(p.token);
    });
  }
}

// ==========================================
// UPDATE PERFORMANCE (Called when data received)
// ==========================================
function updatePerformance(token) {
  if (activeSubscriptions.has(token)) {
    const data = activeSubscriptions.get(token);
    data.lastUpdate = Date.now();
    data.performance = Math.min(1.0, (data.performance || 0.5) + 0.1);
    activeSubscriptions.set(token, data);
  }
}

// ==========================================
// MANUAL SUBSCRIBE (For user search or specific requests)
// ==========================================
function manualSubscribe(tokens) {
  if (!Array.isArray(tokens)) {
    tokens = [tokens];
  }

  const tokensToSubscribe = tokens.map(t => ({
    token: t.token,
    symbol: t.symbol,
    exchange: t.exchange || "NSE",
    exchangeType: t.exchangeType || 1,
    mode: 3
  }));

  const success = subscribeTokens(tokensToSubscribe, "manual");

  if (success) {
    // Add to tracking with high priority
    tokensToSubscribe.forEach(t => {
      activeSubscriptions.set(t.token, {
        symbol: t.symbol,
        exchange: t.exchange,
        score: 999, // High priority
        subscribedAt: Date.now(),
        lastUpdate: Date.now(),
        performance: 1.0,
        reason: "manual",
        isManual: true
      });
    });
  }

  return {
    success,
    message: success ? `Subscribed ${tokensToSubscribe.length} tokens` : "Subscription failed"
  };
}

// ==========================================
// MANUAL UNSUBSCRIBE
// ==========================================
function manualUnsubscribe(tokens) {
  if (!Array.isArray(tokens)) {
    tokens = [tokens];
  }

  const success = unsubscribeTokens(tokens, "manual");

  if (success) {
    tokens.forEach(t => {
      const token = typeof t === "string" ? t : t.token;
      activeSubscriptions.delete(token);
    });
  }

  return {
    success,
    message: success ? `Unsubscribed ${tokens.length} tokens` : "Unsubscription failed"
  };
}

// ==========================================
// GET FOCUS STATUS
// ==========================================
function getFocusStatus() {
  const subscriptions = Array.from(activeSubscriptions.entries()).map(([token, data]) => ({
    token,
    symbol: data.symbol,
    score: data.score,
    performance: data.performance,
    age: Math.floor((Date.now() - data.subscribedAt) / 1000),
    reason: data.reason
  }));

  // Sort by score
  subscriptions.sort((a, b) => b.score - a.score);

  return {
    active: focusManagerActive,
    subscriptionCount: activeSubscriptions.size,
    maxTokens: MAX_LIVE_TOKENS,
    utilization: ((activeSubscriptions.size / MAX_LIVE_TOKENS) * 100).toFixed(1),
    subscriptions: subscriptions.slice(0, 50), // Return top 50
    rotationInterval: ROTATION_INTERVAL,
    nextRotation: rotationTimer ? "Active" : "Inactive"
  };
}

// ==========================================
// GET ACTIVE TOKENS (For external use)
// ==========================================
function getActiveTokens() {
  return Array.from(activeSubscriptions.values()).map(data => ({
    symbol: data.symbol,
    token: data.token,
    exchange: data.exchange,
    score: data.score,
    reason: data.reason
  }));
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  startFocusManager,
  stopFocusManager,
  performRotation,
  checkPerformance,
  updatePerformance,
  manualSubscribe,
  manualUnsubscribe,
  getFocusStatus,
  getActiveTokens,
  MAX_LIVE_TOKENS
};
