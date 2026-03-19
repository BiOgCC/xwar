const fs = require('fs');
const https = require('https');

const activeIso3 = new Set([
  'USA','CAN','RUS','CHN','DEU','JPN','GBR','BRA','IND','NGA',
  'TUR','MEX','CUB','BHS','FRA','ESP','ITA','POL','UKR','ROU',
  'NLD','BEL','SWE','NOR','FIN','DNK','AUT','CHE','CZE','PRT',
  'GRC','HUN','IRL','ISL','SRB','BLR','BGR','SVK','HRV','LTU',
  'LVA','EST','SVN','BIH','ALB','MKD','MNE','MDA','ARG','COL',
  'VEN','PER','CHL','ECU','BOL','PRY','URY','GUY','SUR','GTM',
  'HND','SLV','NIC','CRI','PAN','DOM','HTI','JAM','KOR','PRK',
  'TWN','THA','VNM','PHL','MYS','IDN','MMR','BGD','PAK','AFG',
  'IRQ','IRN','SAU','ARE','ISR','SYR','JOR','LBN','YEM','OMN',
  'KWT','QAT','GEO','ARM','AZE','KAZ','UZB','TKM','KGZ','TJK',
  'MNG','NPL','LKA','KHM','LAO','ZAF','EGY','KEN','ETH','TZA',
  'GHA','CIV','CMR','AGO','MOZ','MDG','MAR','DZA','TUN','LBY',
  'SDN','SSD','UGA','SEN','MLI','BFA','NER','TCD','COD','COG',
  'CAF','GAB','GNQ','MWI','ZMB','ZWE','BWA','NAM','SOM','ERI',
  'MRT','AUS','NZL','PNG'
]);

function fetchGeo(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(data).toString())));
    }).on('error', reject);
  });
}

async function build() {
  console.log('Downloading 10m states...');
  const geo10m = await fetchGeo('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson');
  console.log('Downloading 50m states...');
  const geo50m = await fetchGeo('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_1_states_provinces_shp.geojson');

  console.log('Merging and optimizing...');
  const features = [];
  const processedIso3s = new Set();

  // Prefer 50m for US, CA, BR, AU to save megabytes!
  geo50m.features.forEach(f => {
    const iso3 = f.properties.adm0_a3 || f.properties.sr_adm0_a3;
    if (activeIso3.has(iso3)) {
      processedIso3s.add(iso3);
      const name = f.properties.name || f.properties.name_en || f.properties.woe_name;
      features.push({
        type: 'Feature',
        properties: { adm0_a3: iso3, name: name },
        geometry: f.geometry
      });
    }
  });

  // Use 10m for the rest of the 76 countries!
  geo10m.features.forEach(f => {
    const iso3 = f.properties.adm0_a3;
    if (activeIso3.has(iso3) && !processedIso3s.has(iso3)) {
      const name = f.properties.name || f.properties.name_en || f.properties.woe_name;
      features.push({
        type: 'Feature',
        properties: { adm0_a3: iso3, name: name },
        geometry: f.geometry
      });
    }
  });

  const finalGeo = { type: 'FeatureCollection', features };
  const dir = './public/data';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/world_states.geojson`, JSON.stringify(finalGeo));
  
  console.log('Successfully saved optimized unified world_states.geojson to public/data!');
}

build().catch(console.error);
