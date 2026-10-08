#!/usr/bin/env node
// Build the world map for /admin/stats into src/lib/features/stats/world.json (committed):
// each country's outline as an SVG path, keyed by the ISO 3166 two-letter code that votes store,
// with the box round its largest piece of land. The map zooms to the boxes of the countries with
// votes, so France's box is mainland France, not French Guiana too.
//
//   pnpm map   → rebuild after changing the detail, the projection or the width
//
// The shapes are Natural Earth's (via world-atlas), drawn with the Equal Earth projection, which
// keeps countries' areas true. Only this script needs the map packages; the site gets plain paths.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoArea, geoEqualEarth, geoPath } from 'd3-geo';
import countries from 'i18n-iso-countries';
import { feature } from 'topojson-client';
import { presimplify, quantile, simplify } from 'topojson-simplify';

const require = createRequire(import.meta.url);
const OUT = new URL('../src/lib/features/stats/world.json', import.meta.url);
// Natural Earth's 1:50m shapes, which have the small countries (Malta, Singapore) that 1:110m
// leaves out, thinned to keep only the corners that matter: KEEP is the share of points kept.
const DETAIL = '50m';
const KEEP = 0.1;
// Islands smaller than this, in square map units, are left out.
const MIN_AREA = 0.5;
// Map units across; paths are rounded to a tenth of one.
const WIDTH = 1000;
// Shapes without a numeric code, by name. Northern Cyprus is drawn as part of Cyprus.
const BY_NAME = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };

const full = presimplify(JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${DETAIL}.json`), 'utf8')));
const topo = simplify(full, quantile(full, KEEP));
const world = feature(topo, topo.objects.countries);
// Antarctica would take a fifth of the map, and nobody votes from there.
world.features = world.features.filter((f) => f.properties.name !== 'Antarctica');

const projection = geoEqualEarth().fitWidth(WIDTH, world);
const path = geoPath(projection).digits(1);
const height = Math.ceil(path.bounds(world)[1][1]);

/** The feature's pieces of land, largest first. */
function pieces(f) {
  if (f.geometry.type !== 'MultiPolygon') return [f.geometry];
  return f.geometry.coordinates
    .map((coordinates) => ({ type: 'Polygon', coordinates }))
    .sort((a, b) => geoArea(b) - geoArea(a));
}

/**
 * The box round the largest outline in a path. Shapes that cross the 180° line are drawn in two
 * parts, at both edges of the map, so Russia's box is the part west of it, not the whole map.
 */
function mainBox(d) {
  let best = null;
  for (const ring of d.split('M').filter(Boolean)) {
    const points = ring.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number));
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      area += x0 * y1 - x1 * y0;
    }
    if (!best || Math.abs(area) > best.area) best = { area: Math.abs(area), points };
  }
  const xs = best.points.map((p) => p[0]);
  const ys = best.points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((n) => Math.round(n));
}

const out = {};
const skipped = [];
for (const f of world.features) {
  const code = BY_NAME[f.properties.name] ?? (f.id && countries.numericToAlpha2(f.id));
  // Islands too small to see are left out, but never a country's largest piece.
  const [main, ...rest] = pieces(f);
  const kept = [main, ...rest.filter((p) => path.area(p) >= MIN_AREA)];
  const d = kept.map((p) => path(p)).join('');
  if (!code || !d) {
    skipped.push(f.properties.name);
    continue;
  }
  const box = mainBox(path(main));
  if (out[code]) {
    // A second shape for the same country: draw both, and keep the larger box.
    out[code].d += d;
    const [x0, y0, x1, y1] = out[code].box;
    if ((box[2] - box[0]) * (box[3] - box[1]) > (x1 - x0) * (y1 - y0)) out[code].box = box;
  } else {
    out[code] = { d, box };
  }
}

writeFileSync(OUT, JSON.stringify({ width: WIDTH, height, countries: out }) + '\n');
const kb = Math.round(readFileSync(OUT).length / 1024);
console.log(`world.json: ${Object.keys(out).length} countries, ${WIDTH}×${height}, ${kb} KB`);
if (skipped.length) console.log(`Left out (no country code): ${skipped.join(', ')}`);
