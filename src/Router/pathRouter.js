// Router/pathRouter.js
const express = require("express");
const pathRouter = express.Router();
const { planMultiAgentPathsTime } = require("../service/pathService");

/**
 * 예시 HTTP Endpoint:
 * POST /api/planMulti
 * body: {
 *   agents: [
 *     { agentID: "A1", start:{lat,lon,alt}, end:{lat,lon,alt} },
 *     { agentID: "A2", ... },
 *     ...
 *   ]
 * }
 */
pathRouter.post("/planMulti", async (req, res) => {
  try {
    const { agents } = req.body;
    if (!agents || !Array.isArray(agents)) {
      return res.status(400).json({ error: "Invalid agents" });
    }

    const results = await planMultiAgentPathsTime(agents);
    res.json({ ok: true, results });
  } catch (error) {
    console.error("planMulti error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = pathRouter;
