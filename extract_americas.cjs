const fs = require('fs');

const geo = JSON.parse(fs.readFileSync('states.geojson', 'utf8'));
const targetISOs = ['ARG','COL','VEN','PER','CHL','ECU','BOL','PRY','URY','GUY','SUR','GTM','HND','SLV','NIC','CRI','PAN','DOM','HTI','JAM'];
const ISO_MAP = {'ARG':'AR','COL':'CO','VEN':'VE','PER':'PE','CHL':'CL','ECU':'EC','BOL':'BO','PRY':'PY','URY':'UY','GUY':'GY','SUR':'SR','GTM':'GT','HND':'HN','SLV':'SV','NIC':'NI','CRI':'CR','PAN':'PA','DOM':'DO','HTI':'HT','JAM':'JM'};
const out = {};
geo.features.forEach(f => {
  const iso = f.properties.adm0_a3;
  if(targetISOs.includes(iso)) {
    if(!out[iso]) out[iso] = [];
    out[iso].push(f);
  }
});

let result = '';
targetISOs.forEach(iso => {
  if(!out[iso]) return;
  const cc = ISO_MAP[iso];
  result += '  // ── ' + out[iso][0].properties.admin + ' ──\n';
  
  let cMinX = 180, cMaxX = -180, cMinY = 90, cMaxY = -90;
  out[iso].forEach(of => {
     const walk = c => { 
       if(typeof c[0]==='number') { 
         if(c[0]<cMinX) cMinX=c[0]; if(c[0]>cMaxX) cMaxX=c[0]; 
         if(c[1]<cMinY) cMinY=c[1]; if(c[1]>cMaxY) cMaxY=c[1]; 
       } else c.forEach(walk); 
     };
     walk(of.geometry.coordinates);
  });

  out[iso].forEach((f, i) => {
    let name = f.properties.name || f.properties.name_en || f.properties.woe_name;
    if (!name) name = 'Unknown';
    let idStr = name.replace(/[^a-zA-Z]/g,'').substring(0,6).toUpperCase();
    if (!idStr) idStr = `${i}`;
    let id = cc + '-' + idStr;
    
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    const walk2 = c => { 
      if(typeof c[0]==='number') { 
        if(c[0]<minX) minX=c[0]; if(c[0]>maxX) maxX=c[0]; 
        if(c[1]<minY) minY=c[1]; if(c[1]>maxY) maxY=c[1]; 
      } else c.forEach(walk2); 
    };
    walk2(f.geometry.coordinates);
    
    let cx = minX < maxX ? (minX+maxX)/2 : 0; 
    let cy = minY < maxY ? (minY+maxY)/2 : 0;
    
    let offX = cMaxX > cMinX ? (cx - cMinX) / (cMaxX - cMinX) : 0.5;
    let offY = cMaxY > cMinY ? (cy - cMinY) / (cMaxY - cMinY) : 0.5;
    
    result += `  R('${id}', '${name.replace(/'/g, "\\'")}', '${cc}', ${offX.toFixed(2)}, ${offY.toFixed(2)}, [], 20),\n`;
  });
});
fs.writeFileSync('americas.txt', result);
console.log('Done writing americas.txt');
