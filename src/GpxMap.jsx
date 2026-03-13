import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-gpx';

// Leaflet 기본 아이콘 설정 (웹팩/Vite 이슈 해결)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [12, 20],
  iconAnchor: [6, 20]
});
L.Marker.prototype.options.icon = DefaultIcon;

function GpxMap({ gpxData }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

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

    // 5. 가상 URL을 이용해 GPX 그리기 (마커 URL 수정)
    const gpxLayer = new L.GPX(gpxUrl, {
      async: true,
      marker_options: {
        // 💡 null 대신 유효한 마커 아이콘 URL을 입력해야 마커가 나옵니다.
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
      // 코스가 다 그려지면 자동으로 코스 위치로 카메라 이동
      map.fitBounds(e.target.getBounds());
    }).on('error', (e) => {
      console.error("GPX 파싱 에러:", e);
    }).addTo(map);

    // 6. 클린업: 가상 URL 해제
    return () => {
      URL.revokeObjectURL(gpxUrl);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [gpxData]); 

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '300px', borderRadius: '8px', zIndex: 0 }} 
    />
  );
}

export default GpxMap;