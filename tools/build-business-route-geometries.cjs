// Build initialization route references from public OSM rail infrastructure and sea corridors.
// This does not call telemetry systems or invent AIS / BeiDou observations.
const fs = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { meters } = require('./initialize-business-data.cjs');
const fixtures = resolve('tools/fixtures/geometry-references');
const sourceQueries = {
  'osm-northeast-rail.json': '[out:json][timeout:60];way["railway"="rail"]["highspeed"!="yes"](40.1,121.7,45.9,127.1);out body geom;',
  'osm-north-south-rail.json': '[out:json][timeout:90];way["railway"="rail"]["highspeed"!="yes"]["name"~"京广|京哈|沈山|津山|津霸|京九|石德|衡广|于虎|沈大|广清|京包|丰沙"](22.9,112.4,42.2,124.1);out body geom;',
  'osm-guangzhou-rail.json': '[out:json][timeout:40];way["railway"="rail"](23.10,113.0,23.45,113.5);out body geom;',
  'osm-beijing-tianjin-rail.json': '[out:json][timeout:50];way["railway"="rail"]["highspeed"!="yes"](38.8,116.0,40.5,120.0);out body geom;',
};

function gcj(lng, lat) {
  const pi = Math.PI, x = lng - 105, y = lat - 35;
  let latitude = -100 + 2 * x + 3 * y + .2 * y * y + .1 * x * y + .2 * Math.sqrt(Math.abs(x));
  latitude += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
  latitude += (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3;
  latitude += (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3;
  let longitude = 300 + x + 2 * y + .1 * x * x + .1 * x * y + .1 * Math.sqrt(Math.abs(x));
  longitude += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
  longitude += (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3;
  longitude += (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3;
  const rad = lat / 180 * pi, magic = 1 - .00669342162296594323 * Math.sin(rad) ** 2, root = Math.sqrt(magic);
  latitude = latitude * 180 / ((6378245 * (1 - .00669342162296594323)) / (magic * root) * pi);
  longitude = longitude * 180 / (6378245 / root * Math.cos(rad) * pi);
  return [lng + longitude, lat + latitude];
}

class Heap {
  list = [];
  push(value) { this.list.push(value); let i = this.list.length - 1; while (i) { const p = (i - 1) >> 1; if (this.list[p][0] <= value[0]) break; this.list[i] = this.list[p]; i = p; } this.list[i] = value; }
  pop() { const first = this.list[0], value = this.list.pop(); if (!this.list.length) return first; let i = 0; while (true) { let c = i * 2 + 1; if (c >= this.list.length) break; if (c + 1 < this.list.length && this.list[c + 1][0] < this.list[c][0]) c++; if (this.list[c][0] >= value[0]) break; this.list[i] = this.list[c]; i = c; } this.list[i] = value; return first; }
}

function graph(files) {
  const nodes = new Map(), adjacency = new Map(), ways = new Map();
  for (const file of files) {
    const source = JSON.parse(fs.readFileSync(resolve(fixtures, file), 'utf8'));
    for (const way of source.elements) {
      if (way.type !== 'way' || way.tags?.railway !== 'rail' || way.tags?.highspeed === 'yes' || /高速|客专|城际|客运专线/.test(way.tags?.name || '')) continue;
      if (ways.has(way.id)) continue;
      ways.set(way.id, way.tags);
      for (let i = 0; i < way.nodes.length; i++) {
        const p = way.geometry?.[i]; if (!p || !Number.isFinite(p.lon)) continue;
        nodes.set(way.nodes[i], gcj(p.lon, p.lat));
        if (!adjacency.has(way.nodes[i])) adjacency.set(way.nodes[i], []);
        if (!i || !nodes.has(way.nodes[i - 1])) continue;
        const distance = meters(nodes.get(way.nodes[i - 1]), nodes.get(way.nodes[i]));
        adjacency.get(way.nodes[i - 1]).push({ to: way.nodes[i], distance, way: way.id });
        adjacency.get(way.nodes[i]).push({ to: way.nodes[i - 1], distance, way: way.id });
      }
    }
  }
  return { nodes, adjacency, ways };
}

function nearest(g, point, count = 32) {
  return [...g.nodes].map(([id, coords]) => ({ id, distance: meters(coords, point) })).sort((a, b) => a.distance - b.distance).slice(0, count);
}

function railPath(g, origin, destination) {
  const origins = nearest(g, origin), destinations = nearest(g, destination), targets = new Map(destinations.filter(n => n.distance < 1000).map(n => [n.id, n]));
  const heap = new Heap(), best = new Map(), previous = new Map(), starting = new Map();
  for (const n of origins.filter(n => n.distance < 1000)) { best.set(n.id, n.distance * 4); starting.set(n.id, n.distance); heap.push([n.distance * 4, n.id]); }
  let found = null;
  while (heap.list.length) {
    const [cost, current] = heap.pop(); if (cost !== best.get(current)) continue;
    if (targets.has(current)) { found = current; break; }
    for (const edge of g.adjacency.get(current) || []) {
      const tags = g.ways.get(edge.way), multiplier = tags?.service ? 1.05 : 1;
      const next = cost + edge.distance * multiplier;
      if (next < (best.get(edge.to) ?? Infinity)) { best.set(edge.to, next); previous.set(edge.to, { from: current, way: edge.way }); heap.push([next, edge.to]); }
    }
  }
  if (found == null) throw Error('铁路图不可达：' + JSON.stringify({ origin, destination, nearestStart: origins[0], nearestEnd: destinations[0], explored: best.size }));
  const pointIds = [found], usedWays = new Set();
  let cursor = found;
  while (previous.has(cursor)) { const edge = previous.get(cursor); usedWays.add(edge.way); cursor = edge.from; pointIds.push(cursor); }
  pointIds.reverse();
  const orderedWays = [...usedWays].reverse();
  const coords = pointIds.map(i => g.nodes.get(i));
  return { coordinates: [origin, ...coords, destination], railWayIds: orderedWays, railLineNames: [...new Set(orderedWays.map(i => g.ways.get(i)?.name).filter(Boolean))],
    connectionMeters: { origin: meters(origin, coords[0]), destination: meters(destination, coords.at(-1)) },
    graphNodesVisited: best.size, infrastructureNodes: coords.length };
}

function densify(points, maxMetres = 1400) {
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], count = Math.ceil(meters(a, b) / maxMetres);
    for (let n = 1; n <= count; n++) result.push([a[0] + (b[0] - a[0]) * n / count, a[1] + (b[1] - a[1]) * n / count]);
  }
  return result;
}

function main() {
  const preview = JSON.parse(fs.readFileSync(resolve('docs/acceptance/business-data-initialization-preview.json'), 'utf8'));
  let missing = preview.pendingGeometry;
  const files = ['osm-northeast-rail.json', 'osm-north-south-rail.json', 'osm-guangzhou-rail.json', 'osm-beijing-tianjin-rail.json'].filter(file => fs.existsSync(resolve(fixtures, file)));
  const g = graph(files);
  let routes = {};
  if (fs.existsSync(resolve('tools/fixtures/business-route-geometries.json'))) routes = JSON.parse(fs.readFileSync(resolve('tools/fixtures/business-route-geometries.json'), 'utf8')).routes || {};
  if (process.argv.includes('--rebuild')) {
    const targets = new Map(missing.map(target => [target.key, target]));
    for (const [key, route] of Object.entries(routes)) {
      const [mode, origin, destination] = key.split('|');
      targets.set(key, { key, mode, origin: { name: origin, lng: route.coordinates[0][0], lat: route.coordinates[0][1] },
        destination: { name: destination, lng: route.coordinates.at(-1)[0], lat: route.coordinates.at(-1)[1] } });
    }
    missing = [...targets.values()];
  }
  const failures = [];
  for (const target of missing.filter(s => s.mode === 'RAIL')) {
    try {
      const result = railPath(g, [target.origin.lng, target.origin.lat], [target.destination.lng, target.destination.lat]);
      routes[target.key] = { mode: 'RAIL', source: 'OPENSTREETMAP_RAIL_INFRASTRUCTURE', sourceUrl: 'https://www.openstreetmap.org/copyright',
        quality: 'PUBLIC_INFRASTRUCTURE_REFERENCE', routeProfile: 'OSM_CONVENTIONAL_RAIL', queriedAt: new Date().toISOString(), coordinateSystem: 'GCJ02',
        attribution: '© OpenStreetMap contributors (ODbL)', originalCoordinateSystem: 'WGS84', ...result,
        notes: '沿公开铁路基础设施图拼接的参考走向。排除已标注高速/客运专线；不表示国铁确认的货运排程、列车定位或实际走行。港站内≤1千米接驳仅是参考连接，待货场确认。' };
      console.log(target.key + ': ' + result.coordinates.length + ' 个轨道节点；' + result.railLineNames.join('、'));
    } catch (error) { failures.push({ key: target.key, error: error.message }); console.log(error.message); }
  }
  const offshore = [[122.101431, 40.291018], [121.91, 40.21], [121.72, 39.98], [121.42, 39.63], [121.1, 39.21], [120.92, 38.85],
    [121.12, 38.54], [121.63, 38.29], [122.26, 38.07], [122.91, 37.83], [123.42, 37.19], [123.73, 36.43], [123.84, 35.51],
    [123.91, 34.49], [123.77, 33.31], [123.51, 32.15], [123.15, 30.93], [123.03, 29.81], [122.56, 28.78],
    [121.96, 27.79], [121.08, 26.7], [120.36, 25.84], [119.54, 25.13], [118.76, 24.32], [117.78, 23.44], [116.71, 22.75],
    [115.5, 22.22], [114.69, 21.96], [114.08, 21.98], [113.86, 22.19], [113.74, 22.35], [113.69, 22.48], [113.674, 22.56], [113.673912, 22.647659]];
  const river = [[113.673912, 22.647659], [113.665, 22.685], [113.663, 22.721], [113.663, 22.757], [113.65, 22.792],
    [113.621, 22.827], [113.601, 22.856], [113.578, 22.887], [113.559, 22.917], [113.549, 22.947], [113.541, 22.977], [113.533523, 23.019035]];
  for (const target of missing.filter(s => s.mode === 'WATER')) {
    const nodes = target.destination.name === '新沙港' ? offshore.concat(river.slice(1)) : offshore;
    routes[target.key] = { mode: 'WATER', source: 'PUBLIC_COASTAL_CORRIDOR_REFERENCE', sourceUrl: 'https://www.panasiashipping.com/contents/Product/14.html',
      quality: 'INITIALIZATION_REFERENCE', routeProfile: 'BOHAI_YELLOW_EAST_SOUTH_CHINA_SEA_CORRIDOR', coordinates: densify(nodes),
      coordinateSystem: 'GCJ02', queriedAt: new Date().toISOString(), corridorNodes: nodes,
      notes: '按已公开营口—华南港口业务流向生成的沿海参考航路，经辽东湾、渤海海峡、黄海、东海、台湾海峡外侧及珠江口。密集坐标不是AIS、官方海图或可用于航海的导航指令；具体航道、避让、靠泊路径和实际航迹须以承运方资料核验。' };
  }
  for (const route of Object.values(routes)) {
    route.distanceMeters = Math.round(route.coordinates.slice(1).reduce((sum, p, i) => sum + meters(route.coordinates[i], p), 0));
    route.durationSeconds = Math.round(route.distanceMeters / (route.mode === 'RAIL' ? 35 : 24) / 1000 * 3600);
    route.checksum = createHash('sha256').update(JSON.stringify(route.coordinates)).digest('hex');
  }
  const report = { builtAt: new Date(), routes, failures, sources: files.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(resolve(fixtures, file))).digest('hex'),
    source: 'OpenStreetMap Overpass API', url: 'https://overpass-api.de/api/interpreter', query: sourceQueries[file],
    osmTimestamp: JSON.parse(fs.readFileSync(resolve(fixtures, file), 'utf8')).osm3s?.timestamp_osm_base,
    attribution: '© OpenStreetMap contributors (ODbL)' })),
    note: '业务定位点由参考几何初始化，不能当成实时遥测。' };
  fs.writeFileSync(resolve('tools/fixtures/business-route-geometries.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(resolve('docs/acceptance/business-route-geometry-review.json'), JSON.stringify({ ...report, routes: Object.fromEntries(Object.entries(routes).map(([key, v]) => [key, { ...v, coordinates: undefined, corridorNodes: undefined, points: v.coordinates.length }])) }, null, 2));
}
if (require.main === module) main();
module.exports = { gcj, graph, railPath, densify };
