// Router/pathRouter.js
const express = require("express");
const pathRouter = express.Router();
const {
  planSinglePathIgnoringOtherAircrafts,
  insertFlight,
} = require("../Service/pathService");

/**
 * POST /api/path/single
 * body: { user_id, originID, destinationID }
 */
pathRouter.post("/single", async (req, res) => {
  try {
    const { user_id, originID, destinationID } = req.body;
    console.log("[DBG] POST /api/path/single called", req.body);

    if (!user_id || !originID || !destinationID) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // 1) 비행 기록 삽입/갱신
    const flightID = await insertFlight(user_id, originID, destinationID);

    // 2) 경로 생성
    const path = await planSinglePathIgnoringOtherAircrafts(originID, destinationID);

    if (path.length === 0) {
      console.log("[DBG] No valid path found");
      return res.json({
        ok: false,
        flightID,
        message: "No valid path found",
      });
    }

    console.log("[DBG] Path found, length =", path.length);
    return res.json({
      ok: true,
      flightID,
      path,
    });
  } catch (error) {
    console.error("Error in /api/path/single:", error);
    return res.status(500).json({ error: "Internal Server Error", detail: error.message });
  }
});

module.exports = pathRouter;
