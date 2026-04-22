"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// We use dynamic imports for leaflet.heat in the actual app, here we will simulate or use raw access if available.
// In a real next.js build we would need to dynamically import leaflet-heat
import "leaflet.heat";

interface HeatmapViewProps {
  points: [number, number, number][]; // [lat, lng, intensity]
}

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    // Check if heatLayer is available on L (requires leaflet.heat)
    if (!(L as any).heatLayer) return;

    const layer = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.4: "blue",
        0.6: "cyan",
        0.7: "lime",
        0.8: "yellow",
        1.0: "red"
      }
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

export default function HeatmapView({ points }: HeatmapViewProps) {
  // Ensure we're in browser
  if (typeof window === "undefined") return null;

  // Center on Jakarta
  const center: [number, number] = [-6.2088, 106.8456];

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full bg-bg-secondary"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <HeatLayer points={points} />
    </MapContainer>
  );
}
