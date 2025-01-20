const client = require('../redis.js');

const flightService = {
  updateFlightData: async (flightData) => {
    try {
      const key = `flight:${flightData.flightId}`;
      await client.set(key, JSON.stringify(flightData));
      return true;
    } catch (error) {
      console.error("Failed to update flight data:", error);
      return false;
    }
  },
  getAllFlights: async () => {
    const flights = await client.hGetAll('flights');
    return Object.entries(flights).map(([flight_id, data]) => ({
      flight_id,
      ...JSON.parse(data)
    }));
  },
  getFlightData: async (flightId) => {
    const flightData = await client.hGet(`flight:${flightId}`);
    return JSON.parse(flightData);
  },
};