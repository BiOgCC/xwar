/**
 * generate-routes.cjs
 * Uses searoute-js to compute the top 13 maritime trading routes
 * and writes them as a single GeoJSON FeatureCollection.
 *
 * Run:  node scripts/generate-routes.cjs
 */
const searoute = require('searoute-js')
const fs = require('fs')
const path = require('path')

// Helper: create a GeoJSON Point feature
const pt = (lng, lat) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Point', coordinates: [lng, lat] }
})

// ── Top 13 maritime trading routes ──
const ROUTES = [
  {
    name: 'Malacca Strait Lane',
    from: 'Singapore', fromCountry: 'SG', fromCoords: [103.85, 1.29],
    to: 'Shanghai', toCountry: 'CN', toCoords: [121.47, 31.23],
    resourceTypes: ['oil', 'tradedGoods'], oil: 200, fish: 0, tradedGoods: 800,
  },
  {
    name: 'Suez Canal Lane',
    from: 'Port Said', fromCountry: 'EG', fromCoords: [32.30, 31.26],
    to: 'Jebel Ali', toCountry: 'AE', toCoords: [55.03, 25.01],
    resourceTypes: ['oil', 'tradedGoods'], oil: 350, fish: 0, tradedGoods: 1200,
  },
  {
    name: 'Panama Canal Lane',
    from: 'Colón', fromCountry: 'PA', fromCoords: [-79.90, 9.36],
    to: 'Los Angeles', toCountry: 'US', toCoords: [-118.25, 33.75],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 1500,
  },
  {
    name: 'Hormuz Strait Lane',
    from: 'Dubai', fromCountry: 'AE', fromCoords: [55.27, 25.20],
    to: 'Mumbai', toCountry: 'IN', toCoords: [72.88, 19.08],
    resourceTypes: ['oil'], oil: 500, fish: 0, tradedGoods: 0,
  },
  {
    name: 'Cape Route',
    from: 'Cape Town', fromCountry: 'ZA', fromCoords: [18.42, -33.92],
    to: 'Rotterdam', toCountry: 'NL', toCoords: [4.48, 51.92],
    resourceTypes: ['oil', 'tradedGoods'], oil: 280, fish: 0, tradedGoods: 900,
  },
  {
    name: 'English Channel Lane',
    from: 'Rotterdam', fromCountry: 'NL', fromCoords: [4.48, 51.92],
    to: 'London', toCountry: 'GB', toCoords: [-0.12, 51.51],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 1000,
  },
  {
    name: 'North Atlantic Lane',
    from: 'New York', fromCountry: 'US', fromCoords: [-74.00, 40.71],
    to: 'Rotterdam', toCountry: 'NL', toCoords: [4.48, 51.92],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 1400,
  },
  {
    name: 'Trans-Pacific Lane',
    from: 'Shanghai', fromCountry: 'CN', fromCoords: [121.47, 31.23],
    to: 'Los Angeles', toCountry: 'US', toCoords: [-118.25, 33.75],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 1800,
  },
  {
    name: 'South China Sea Lane',
    from: 'Hong Kong', fromCountry: 'CN', fromCoords: [114.17, 22.28],
    to: 'Singapore', toCountry: 'SG', toCoords: [103.85, 1.29],
    resourceTypes: ['tradedGoods', 'fish'], oil: 0, fish: 80, tradedGoods: 600,
  },
  {
    name: 'Mediterranean Lane',
    from: 'Genoa', fromCountry: 'IT', fromCoords: [8.93, 44.41],
    to: 'Istanbul', toCountry: 'TR', toCoords: [28.98, 41.01],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 700,
  },
  {
    name: 'Arabian Sea Lane',
    from: 'Mumbai', fromCountry: 'IN', fromCoords: [72.88, 19.08],
    to: 'Djibouti', toCountry: 'DJ', toCoords: [43.15, 11.59],
    resourceTypes: ['oil', 'tradedGoods'], oil: 150, fish: 0, tradedGoods: 500,
  },
  {
    name: 'Baltic Lane',
    from: 'St. Petersburg', fromCountry: 'RU', fromCoords: [30.32, 59.93],
    to: 'Hamburg', toCountry: 'DE', toCoords: [9.99, 53.55],
    resourceTypes: ['tradedGoods'], oil: 0, fish: 0, tradedGoods: 650,
  },
  {
    name: 'East Africa Lane',
    from: 'Durban', fromCountry: 'ZA', fromCoords: [31.02, -29.86],
    to: 'Mumbai', toCountry: 'IN', toCoords: [72.88, 19.08],
    resourceTypes: ['oil', 'tradedGoods'], oil: 180, fish: 0, tradedGoods: 400,
  },
]

// ── Generate routes ──
console.log('🚢 Generating 13 maritime trade routes...\n')

const features = []
let failed = 0

for (const r of ROUTES) {
  const origin = pt(r.fromCoords[0], r.fromCoords[1])
  const dest = pt(r.toCoords[0], r.toCoords[1])

  try {
    const route = searoute(origin, dest, 'nm')
    if (!route) {
      console.log(`  ❌ ${r.name}: No route found`)
      failed++
      continue
    }

    // Merge properties
    route.properties = {
      ...route.properties,
      id: r.name.toLowerCase().replace(/\s+/g, '-'),
      name: r.name,
      from: r.from,
      fromCountry: r.fromCountry,
      fromCoords: r.fromCoords,
      to: r.to,
      toCountry: r.toCountry,
      toCoords: r.toCoords,
      resourceTypes: r.resourceTypes,
      oil: r.oil,
      fish: r.fish,
      tradedGoods: r.tradedGoods,
    }

    features.push(route)
    console.log(`  ✅ ${r.name}: ${r.from} → ${r.to} (${Math.round(route.properties.length)} nm)`)
  } catch (err) {
    console.log(`  ❌ ${r.name}: ${err.message}`)
    failed++
  }
}

// ── Write output ──
const collection = {
  type: 'FeatureCollection',
  features,
}

const outPath = path.join(__dirname, '..', 'public', 'data', 'trade-routes.geojson')
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2))

console.log(`\n✅ Done! ${features.length} routes written to public/data/trade-routes.geojson`)
if (failed > 0) console.log(`⚠️  ${failed} routes failed.`)
