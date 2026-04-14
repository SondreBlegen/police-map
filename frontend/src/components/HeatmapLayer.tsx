import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapLayerProps {
  points: [number, number, number][];
  options?: {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    gradient?: Record<number, string>;
  };
}

export default function HeatmapLayer({ points, options = {} }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    const heat = (L as any).heatLayer(points, {
      radius: options.radius ?? 25,
      blur: options.blur ?? 15,
      maxZoom: options.maxZoom ?? 17,
      max: options.max ?? 1.0,
      gradient: options.gradient ?? {
        0.2: "#ffffb2",
        0.4: "#fecc5c",
        0.6: "#fd8d3c",
        0.8: "#f03b20",
        1.0: "#bd0026",
      },
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, options]);

  return null;
}
