const axios = require("axios");

/* ===============================
   GLOBAL TOKENS
================================ */
let JWT_TOKEN = "";
let REFRESH_TOKEN = "";

/* ===============================
   USER CREDENTIALS
================================ */
const API_KEY = "nclvoLI";
const CLIENT_CODE = "M1007477";
const PASSWORD = "2310";
const TOTP = "453139";

/* ===============================
   LOGIN
================================ */
async function login() {
  try {
    const response = await axios.post(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        clientcode: CLIENT_CODE,
        password: PASSWORD,
        totp: TOTP,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "127.0.0.1",
          "X-ClientPublicIP": "127.0.0.1",
          "X-MACAddress": "00:00:00:00:00:00",
          "X-PrivateKey": API_KEY,
        },
      }
    );

    JWT_TOKEN = response.data.data.jwtToken;
    REFRESH_TOKEN = response.data.data.refreshToken;

    console.log("✅ LOGIN SUCCESS");
    return true;
  } catch (err) {
    console.log("❌ LOGIN FAILED");
    console.log(err.response?.data || err.message);
    return false;
  }
}

/* ===============================
   GET NIFTY LTP
================================ */
async function getNiftyLTP() {
  try {
    if (!JWT_TOKEN) {
      const ok = await login();
      if (!ok) return null;
    }

    const response = await axios.get(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/ltp",
      {
        params: {
          exchange: "NSE",
          tradingsymbol: "NIFTY",
          symboltoken: "99926000",
        },
        headers: {
          Authorization: "Bearer " + JWT_TOKEN,
          "Content-Type": "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "127.0.0.1",
          "X-ClientPublicIP": "127.0.0.1",
          "X-MACAddress": "00:00:00:00:00:00",
          "X-PrivateKey": API_KEY,
        },
      }
    );

    return response.data.data.ltp;
  } catch (err) {
    console.log("❌ LTP ERROR");
    console.log(err.response?.data || err.message);
    return null;
  }
}

/* ===============================
   EXPORT FOR SERVER
================================ */
module.exports = function(app) {
  login();

  app.get("/login", async (req, res) => {
    const ok = await login();
    res.json({ success: ok });
  });

  app.get("/nifty", async (req, res) => {
    const ltp = await getNiftyLTP();
    if (!ltp) {
      return res.status(500).json({ error: "LTP not available" });
    }
    res.json({ symbol: "NIFTY", ltp });
  });
};
