function predictPosition(flight, timeInterval) {
  const distance = flight.speed * timeInterval;
  const radian = flight.direction * (Math.PI / 180);
  const newLatitude = flight.latitude + (distance * Math.cos(radian)) / 111111; // 대략적인 위도 변화
  const newLongitude = flight.longitude + (distance * Math.sin(radian)) / (111111 * Math.cos(flight.latitude * Math.PI / 180));
  return { latitude: newLatitude, longitude: newLongitude };
}

function checkForCollisions(newFlightData) {
  // 모든 비행체 데이터 가져오기
  redisClient.hGetAll('flights').then((flights) => {
    for (const [id, data] of Object.entries(flights)) {
      if (id !== newFlightData.flight_id) {
        const otherFlight = JSON.parse(data);
        const predictedNewFlight = predictPosition(newFlightData, 10); // 10초 후 예측
        const predictedOtherFlight = predictPosition(otherFlight, 10);
        const distance = calculateDistance(predictedNewFlight, predictedOtherFlight);
        if (distance < SAFE_DISTANCE) {
          // 충돌 가능성 존재, 우회 경로 제안
          suggestAlternativeRoute(newFlightData.flight_id);
        }
      }
    }
  });
}

function calculateDistance(pos1, pos2) {
  const R = 6371e3; // 지구 반경 (미터)
  const φ1 = pos1.latitude * Math.PI / 180;
  const φ2 = pos2.latitude * Math.PI / 180;
  const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
  const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
}

module.exports = { checkForCollisions };