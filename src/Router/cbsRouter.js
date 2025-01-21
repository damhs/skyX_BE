// Router/cbsRouter.js
const express = require("express");
const cbsRouter = express.Router();
const { planPathsCBS } = require("../Service/cbsService.js");

/**
 * 예: POST /api/cbsPlan
 * body: {
 *   agents: [
 *     { 
 *       id: "Drone1", 
 *       start: { lat:..., lon:..., alt: 0 }, 
 *       end:   { lat:..., lon:..., alt: 50 }, 
 *       maxAlt: 100 
 *     },
 *     ...
 *   ]
 * }
 */
cbsRouter.post("/cbsPlan", async (req, res) => {
  try {
    const { agents } = req.body;
    if (!agents || !Array.isArray(agents)) {
      return res.status(400).json({ error: "Invalid agents" });
    }

    const results = await planPathsCBS(agents);
    // results: [{ agentID, path: [{lat,lon,alt,t}, ...]}, ...]

    if (results.length === 0) {
      return res.json({ ok: false, message: "No solution or conflict" });
    }
    res.json({ ok: true, data: results });
  } catch (error) {
    console.error("CBS Plan error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = cbsRouter;
