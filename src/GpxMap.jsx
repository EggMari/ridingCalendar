import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-gpx';

// Leaflet 기본 아이콘 설정 (public 폴더의 이미지를 사용하는 경우)
const DefaultIcon = L.icon({
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function GpxMap({ gpxData }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  
  // 💡 거리와 고도 정보를 저장할 상태
  const [stats, setStats] = useState({ distance: 0, elevation: 0 });

  useEffect(() => {
    if (!containerRef.current || !gpxData) return;

    // 1. 기존 지도가 있으면 삭제 (재렌더링 방지)
    if (mapRef.current) {
      mapRef.current.remove();
    }

    // 2. 지도 초기화 (서울 중심)
    const map = L.map(containerRef.current).setView([37.5665, 126.9780], 13);
    mapRef.current = map;

    // 3. 배경 지도 설정 (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // 4. 핵심: 텍스트 데이터를 가상 URL로 변환
    const gpxBlob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const gpxUrl = URL.createObjectURL(gpxBlob);

    // 5. 가상 URL을 이용해 GPX 그리기
    const gpxLayer = new L.GPX(gpxUrl, {
      async: true,
      marker_options: {
        startIconUrl: 'https://cdn.rawgit.com/mpetazzoni/leaflet-gpx/master/pin-icon-start.png',
        endIconUrl: 'https://cdn.rawgit.com/mpetazzoni/leaflet-gpx/master/pin-icon-end.png',
        shadowUrl: 'https://cdn.rawgit.com/mpetazzoni/leaflet-gpx/master/pin-shadow.png'
      },
      polyline_options: {
        color: 'red',
        opacity: 0.75,
        weight: 5,
        lineCap: 'round'
      }
    }).on('loaded', (e) => {
      const gpx = e.target;
      // 코스가 다 그려지면 자동으로 코스 위치로 카메라 이동
      map.fitBounds(gpx.getBounds());

      // 💡 6. GPX 데이터에서 통계 정보 추출
      setStats({
        distance: (gpx.get_distance() / 1000).toFixed(1), // m -> km 변환
        elevation: Math.round(gpx.get_elevation_gain())  // m 단위 반올림
      });
    }).on('error', (e) => {
      console.error("GPX 파싱 에러:", e);
    }).addTo(map);

    // 7. 클린업: 가상 URL 해제
    return () => {
      URL.revokeObjectURL(gpxUrl);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [gpxData]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '300px', borderRadius: '8px', zIndex: 0 }} 
      />
      
      {/* 💡 8. 지도 위에 거리와 획득 고도 표시 오버레이 */}
      {stats.distance > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
          display: 'flex',
          gap: '8px',
          color: '#333'
        }}>
          <span>📏 {stats.distance}km</span>
          <span style={{ color: '#ccc' }}>|</span>
          <span>⛰️ {stats.elevation}m</span>
        </div>
      )}
    </div>
  );
}

export default GpxMap;