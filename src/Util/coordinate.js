// utils/coordinate.js

const R = 6371000; // 지구 평균 반지름 (m)

// 기준점( lat0, lon0 )을 잡아서, 위도/경도를 근사 x,y로 변환
function latLonToXY(lat, lon, lat0, lon0) {
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;
  const radLat0 = (lat0 * Math.PI) / 180;
  const radLon0 = (lon0 * Math.PI) / 180;

  const x = (radLon - radLon0) * Math.cos(radLat0) * R;
  const y = (radLat - radLat0) * R;

  return { x, y };
}

// 반대로 x,y -> lat,lon
function xyToLatLon(x, y, lat0, lon0) {
  const radLat0 = (lat0 * Math.PI) / 180;
  const lat = (y / R) + radLat0;
  const lon = (x / (R * Math.cos(radLat0))) + lon0 * (Math.PI / 180);

  // 라디안 -> 도
  return {
    lat: (lat * 180) / Math.PI,
    lon: (lon * 180) / Math.PI,
  };
}

module.exports = { latLonToXY, xyToLatLon };
