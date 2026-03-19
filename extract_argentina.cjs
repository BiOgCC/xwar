const fs = require('fs');

const geo = JSON.parse(fs.readFileSync('states.geojson', 'utf8'));
const targetISOs = ['ARG'];
const ISO_MAP = {'ARG':'AR'};
const out = {};
geo.features.forEach(f => {
  const iso = f.properties.adm0_a3 || f.properties.sr_adm0_a3;
  if(targetISOs.includes(iso)) {
    if(!out[iso]) out[iso] = [];
    out[iso].push(f);
  }
});

let result = '';
targetISOs.forEach(iso => {
  if(!out[iso]) return;
  const cc = ISO_MAP[iso];
  result += '  // ── ' + (out[iso][0].properties.admin || 'Argentina') + ' ──\n';
  
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
    // Map bounds Y is flipped in offset (0 is top, 1 is bottom)
    offY = 1 - offY;
    
    result += `  R('${id}', '${name.replace(/'/g, "\\'")}', '${cc}', ${offX.toFixed(2)}, ${offY.toFixed(2)}, [], 30),\n`;
  });
});
fs.writeFileSync('argentina.txt', result);
console.log('Done writing argentina.txt');
