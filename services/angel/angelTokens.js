const axios = require("axios");

const BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";

const HEADERS = {
  "X-UserType": "USER",
  "X-SourceID": "WEB",
  "X-ClientLocalIP": "127.0.0.1",
  "X-ClientPublicIP": "127.0.0.1",
  "X-MACAddress": "00:00:00:00:00:00",
  "X-PrivateKey": process.env.ANGEL_API_KEY,
  "Authorization": `Bearer ${process.env.ANGEL_ACCESS_TOKEN}`,
  "Content-Type": "application/json"
};

async function fetchOptionTokens() {
  const res = await axios.get(`${BASE}/marketData/v1/optionTokens`, {
    headers: HEADERS
  });

  return res.data.data.map(t => t.token);
}

module.exports = {
  fetchOptionTokens
};
