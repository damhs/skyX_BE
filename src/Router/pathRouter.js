// Router/pathRouter.js
const express = require("express");
const pathRouter = express.Router();
const { planSinglePathIgnoringOtherAgents, insertFlight } = require("../Service/pathService");

/**
 * POST /api/path/single
 * body: { start:{ lat, lon, alt }, end:{ lat, lon, alt } }
 */
pathRouter.post("/single", async (req, res) => {
  try {
    const { user_id, start, end } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: "Missing start or end" });
    }

    const path = await planSinglePathIgnoringOtherAgents(start, end);
    insertFlight(user_id, start, end);
    if (path.length === 0) {
      return res.json({ ok: false, message: "No valid path" });
    }
    res.json({ ok: true, path });
  } catch (error) {
    console.error("Error in /api/path/single:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = pathRouter;