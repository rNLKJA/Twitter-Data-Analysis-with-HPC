import { geoArea, geoConicConformal, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, MultiPolygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries from "world-atlas/countries-50m.json";

/**
 * Australia outline for the results map, built at render time on the server
 * from Natural Earth 1:50m (world-atlas, public domain). Only the outline
 * string and projected points reach the browser.
 *
 * Projection: Lambert conformal conic with standard parallels 18°S / 36°S,
 * the convention used for national maps of Australia.
 */

export interface AustraliaMap {
  width: number;
  height: number;
  outline: string;
  project(lon: number, lat: number): [number, number];
}

const MAINLAND_WINDOW = { minLon: 110, maxLon: 155, minLat: -45, maxLat: -9 };
/** Drop specks (steradians); keeps Tasmania, Kangaroo Island, Melville Island etc. */
const MIN_POLYGON_AREA = 2e-6;

function australiaFeature(): Feature<MultiPolygon> {
  const topo = countries as unknown as Topology<{ countries: GeometryCollection }>;
  const all = feature(topo, topo.objects.countries);
  const au = all.features.find((f) => f.id === "036");
  if (!au || au.geometry.type !== "MultiPolygon")
    throw new Error("Australia not found in world-atlas");
  const { minLon, maxLon, minLat, maxLat } = MAINLAND_WINDOW;
  const coordinates = au.geometry.coordinates.filter(
    (poly) =>
      poly[0].every(([lon, lat]) => lon > minLon && lon < maxLon && lat > minLat && lat < maxLat) &&
      geoArea({ type: "Polygon", coordinates: poly }) > MIN_POLYGON_AREA,
  );
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates } };
}

let cached: { key: string; map: AustraliaMap } | null = null;

export function australiaMap(width = 800, height = 680, pad = 12): AustraliaMap {
  const key = `${width}x${height}x${pad}`;
  if (cached?.key === key) return cached.map;

  const shape = australiaFeature();
  const projection: GeoProjection = geoConicConformal()
    .parallels([-18, -36])
    .rotate([-134, 0])
    .fitExtent(
      [
        [pad, pad],
        [width - pad, height - pad],
      ],
      shape,
    );
  const outline = geoPath(projection).digits(1)(shape) ?? "";
  const map: AustraliaMap = {
    width,
    height,
    outline,
    project(lon, lat) {
      const p = projection([lon, lat]);
      if (!p) throw new Error(`Cannot project ${lon},${lat}`);
      return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    },
  };
  cached = { key, map };
  return map;
}
