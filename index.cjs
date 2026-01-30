// ==========================================
// ANGEL AUTH + NIFTY LTP SERVICE (SAFE)
// NO HARDCODED CREDENTIALS
// SESSION SAFE | RULE-ALIGNED
// ==========================================

//const axios = require("axios");

// ===============================
// SESSION CACHE
// ===============================
//let JWT_TOKEN = null;

// ===============================
// ENV CONFIG (MANDATORY)
// ===============================
//const {
//  ANGEL_API_KEY,
//  ANGEL_CLIENT_CODE,
//  ANGEL_MPIN,
//  ANGEL_TOTP,
//} = process.env;

// ===============================
// VALIDATION
// ===============================
//function validateEnv() {
 // if (
//    !ANGEL_API_KEY ||
 //   !ANGEL_CLIENT_CODE ||
 //   !ANGEL_MPIN ||
//   !ANGEL_TOTP
//  ) {
//    throw new Error("❌ Angel credentials missing in ENV");
//  }
//}

// ===============================
// LOGIN (MPIN BASED – ANGEL SAFE)
// ===============================
//async function login() {
//  try {
//    validateEnv();

//    const response = await axios.post(
//      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByMPIN",
//      {
//        clientcode: ANGEL_CLIENT_CODE,
//        mpin: ANGEL_MPIN,
//        totp: ANGEL_TOTP,
 //     },
 //     {
 //       headers: {
 //         "Content-Type": "application/json",
 //         "X-UserType": "USER",
 //         "X-SourceID": "WEB",
 //        "X-ClientLocalIP": "127.0.0.1",
 //         "X-ClientPublicIP": "127.0.0.1",
 //         "X-MACAddress": "00:00:00:00:00:00",
  //        "X-PrivateKey": ANGEL_API_KEY,
 //      },
 //     }
 //   );

 //   JWT_TOKEN = response.data?.data?.jwtToken || null;

 //   if (!JWT_TOKEN) {
 //     throw new Error("JWT not received");
 //   }

 //   console.log("✅ Angel Login SUCCESS");
 //   return true;
//  } catch (err) {
//    console.error(
//      "❌ Angel Login Failed:",
//      err.response?.data || err.message
//    );
//    JWT_TOKEN = null;
//    return false;
//  }
//}

// ===============================
// GET NIFTY LTP (SAFE RETRY)
// ===============================
//async function getNiftyLTP() {
//  try {
 //   if (!JWT_TOKEN) {
//      const ok = await login();
 //     if (!ok) return null;
 //   }

//    const response = await axios.get(
 //     "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/ltp",
 //     {
 //       params: {
 //         exchange: "NSE",
 //         tradingsymbol: "NIFTY",
 //         symboltoken: "99926000", // index token (allowed)
 //       },
//        headers: {
//          Authorization: `Bearer ${JWT_TOKEN}`,
//          "Content-Type": "application/json",
//          "X-UserType": "USER",
//          "X-SourceID": "WEB",
//          "X-ClientLocalIP": "127.0.0.1",
//          "X-ClientPublicIP": "127.0.0.1",
//          "X-MACAddress": "00:00:00:00:00:00",
//          "X-PrivateKey": ANGEL_API_KEY,
//        },
 //     }
//    );

//    return response.data?.data?.ltp ?? null;
//  } catch (err) {
//    console.error(
//      "❌ NIFTY LTP Error:",
//      err.response?.data || err.message
//    );
//    JWT_TOKEN = null; // force re-login next time
//    return null;
//  }
//}

// ===============================
// ROUTES
// ===============================
//module.exports = function (app) {
//  app.get("/angel/login", async (req, res) => {
//    const ok = await login();
//    res.json({ success: ok });
//  });

//  app.get("/market/nifty/ltp", async (req, res) => {
//    const ltp = await getNiftyLTP();
//    if (!ltp) {
//      return res.status(503).json({
//        status: false,
//        message: "NIFTY LTP unavailable",
//      });
//    }
//    res.json({
//      status: true,
//      symbol: "NIFTY",
 //     ltp,
//    });
//  });
//};
