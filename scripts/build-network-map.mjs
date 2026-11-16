import fs from "node:fs";

// Natural Earth 5.1.1 India POV geometry; GeoNames India city-centre records.
// Both use one equirectangular projection. Never adjust marker coordinates
// to fit the illustration: retain coastline points near cities instead.
const [geometryFile, cityFile] = process.argv.slice(2);
const geometry = JSON.parse(fs.readFileSync(geometryFile, "utf8"));
const cities = fs.readFileSync(cityFile, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const rings = geometry.coordinates.flat();
const points = rings.flat();
const cosine = Math.cos(22 * Math.PI / 180);
const west = Math.min(...points.map(p => p[0]));
const east = Math.max(...points.map(p => p[0]));
const south = Math.min(...points.map(p => p[1]));
const north = Math.max(...points.map(p => p[1]));
const scale = 90 / Math.max((east - west) * cosine, north - south);
const offsetX = (100 - (east - west) * cosine * scale) / 2;
const offsetY = (100 - (north - south) * scale) / 2;
const project = ([lon, lat]) => [offsetX + (lon - west) * cosine * scale, offsetY + (north - lat) * scale];
const markers = cities.map(c => project([c.longitude, c.latitude]));
function simplify(points) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points.at(-1);
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  let score = 1, split = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
    const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    const nearCity = markers.some(([mx, my]) => Math.hypot(x - mx, y - my) < 1.5);
    const ratio = distance / (nearCity ? 0.12 : 1.5);
    if (ratio > score) { score = ratio; split = i; }
  }
  return split >= 0 ? [...simplify(points.slice(0, split + 1)).slice(0, -1), ...simplify(points.slice(split))] : [points[0], points.at(-1)];
}
const round = x => Number(x.toFixed(4));
const path = rings.map(r => simplify(r.map(project))).filter(r => r.length > 3).map(r => r.map((p, i) => `${i ? "L" : "M"}${p.map(round).join(",")}`).join("") + "Z").join("");
fs.writeFileSync("src/data/network-map.json", JSON.stringify({ path }) + "\n");
const site = JSON.parse(fs.readFileSync("src/data/site.json", "utf8"));
for (const office of site.offices) {
  const c = cities.find(c => c.city === office.city);
  if (!c) throw new Error(`Missing city coordinates: ${office.city}`);
  [office.x, office.y] = project([c.longitude, c.latitude]).map(round);
}
fs.writeFileSync("src/data/site.json", JSON.stringify(site, null, 2) + "\n");
fs.writeFileSync("content/network-map-source.json", JSON.stringify({
  boundary: "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries_ind.zip",
  boundaryLicense: "Natural Earth public domain, version 5.1.1",
  citiesSource: "https://download.geonames.org/export/dump/IN.zip",
  citiesLicense: "GeoNames CC BY 4.0",
  cities,
  projection: { standardParallel: 22, west, north, cosine, scale, offsetX, offsetY },
  note: "Illustrated boundary simplified from geographic data. City-centre coordinates are projected without manual offsets; these are not office addresses."
}, null, 2) + "\n");
