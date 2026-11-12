// MarsL Game Logic: Terrain
// Extracted from server.js during Phase 2 modularization

const {
  BASINS,
  CAMPS_PER_QUARTER,
  CAMP_KIND_AT,
  CAMP_TIERS,
  ICE_PATCHES,
  MAP_ROWS,
  PYLONS,
  RESOURCES,
  VOLCANOES,
} = require('../config');

function turnAround(p, quarter) {
  let x = p.x;
  let y = p.y;
  for (let i = 0; i < quarter; i++) { const t = x; x = -y; y = t; } // 90 degrees counter-clockwise
  return { x, y };
}

function landmarkByKey(key) {
  return LANDMARKS.find((l) => l.key === key) || null;
}

function landmarkAtXY(x, y) {
  return LM_VISIBLE ? LANDMARKS.find((l) => l.x === x && l.y === y) || null : null;
}

function hash3(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, y, scale, seed) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash3(x0, y0, seed);
  const b = hash3(x0 + 1, y0, seed);
  const c = hash3(x0, y0 + 1, seed);
  const d = hash3(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function canonical(x, y) {
  let cx = x;
  let cy = y;
  while (!(cx > 0 && cy >= 0) && !(cx === 0 && cy === 0)) {
    const t = cx;
    cx = cy;
    cy = -t;
  }
  return [cx, cy];
}

function ridge(x, y) {
  const [cx, cy] = canonical(x, y);
  const n = 0.65 * valueNoise(cx, cy, 11, 11) + 0.35 * valueNoise(cx, cy, 5, 12);
  return 1 - Math.abs(n - 0.5) * 2;
}

function generateTerrain(x, y) {
  if (Math.abs(x) > MAP_RADIUS || Math.abs(y) > MAP_RADIUS) return "x";
  if (x === 0 && y === 0) return "b";
  if (LANDMARKS.some((l) => l.x === x && l.y === y)) return "m"; // hidden until the landmarks open
  const dist = Math.hypot(x, y);
  if (dist <= SAFE_RADIUS) return hash3(x, y, 5) < 0.25 ? "d" : "p";
  const [cx, cy] = canonical(x, y); // the same spot in the first quarter

  // a frozen rim all around the planet
  const rim = MAP_RADIUS - 1 - Math.floor(valueNoise(cx, cy, 5, 3) * 3);
  if (Math.max(Math.abs(x), Math.abs(y)) >= rim) return "i";
  for (const p of ICE_PATCHES) if (Math.hypot(cx - p.x, cy - p.y) <= p.r) return "i";

  for (const v of VOLCANOES) {
    const vd = Math.hypot(cx - v.x, cy - v.y);
    if (vd < 0.5) return "v";
    if (vd <= v.ring) return "m";
  }
  for (const b of BASINS) {
    if (Math.hypot(cx - b.x, cy - b.y) <= b.r) return "c";
  }

  // Valles Marineris: a long winding canyon; four of them swirl around the middle
  if (cx >= 9 && cx <= 38) {
    const canyonY = 2 + (cx - 9) * 0.65 + 2.2 * Math.sin(cx / 3.2);
    if (Math.abs(cy - canyonY) <= 0.7) return "k";
  }

  if (hash3(cx, cy, 7) < 0.03) return "c";

  // Mountain chains get a bit more common further out (they hold the
  // stronger monster camps), so the middle stays friendly for beginners.
  const out = Math.min(1, (dist - SAFE_RADIUS) / 18);
  const rg = ridge(x, y);
  if (rg > 0.93 - 0.03 * out) return "m";
  if (rg > 0.88 - 0.03 * out && hash3(cx, cy, 9) < 0.5) return "r";

  const sand = 0.6 * valueNoise(cx, cy, 10, 21) + 0.4 * valueNoise(cx, cy, 4, 22);
  if (sand < 0.36) return "d";
  return "p";
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quarterOf(x, y) {
  return x > 0 && y >= 0 ? 0 : x <= 0 && y > 0 ? 1 : x < 0 && y <= 0 ? 2 : 3;
}

function baseTerrainAt(x, y) {
  if (Math.abs(x) > MAP_RADIUS || Math.abs(y) > MAP_RADIUS) return "x";
  return BASE_ROWS[MAP_RADIUS - y][x + MAP_RADIUS];
}

function rebuildCamps(seed, taken) {
  MAP_SEED = seed;
  for (const k in CAMP_KIND_AT) delete CAMP_KIND_AT[k];
  const rows = BASE_ROWS.map((r) => r.split(""));
  const placed = [];
  const rand = mulberry32(seed * 7919 + 13);
  // Irregular small groups, rotated for equal count, strength and reward access.
  CAMPS_PER_QUARTER.fill(0);
  const rotate=(x,y,q)=>q===0?{x,y}:q===1?{x:-y,y:x}:q===2?{x:-x,y:-y}:{x:y,y:-x};
  const valid=p=>Math.hypot(p.x,p.y)>SAFE_RADIUS && "pdmrc".includes(baseTerrainAt(p.x,p.y)) &&
    !(taken&&taken(p.x,p.y)) && LANDMARKS.every(l=>Math.hypot(l.x-p.x,l.y-p.y)>=3) && PYLONS.every(l=>Math.hypot(l.x-p.x,l.y-p.y)>=3);
  const anchors=[];
  // Weighted, shuffled bags prevent one group size dominating a generated world.
  const sizes=[];
  // layout 2: more lone camps, loose groups with gaps, never a 2x2 block
  const L2=CAMP_LAYOUT===2;
  for(const [size,count] of (L2?[[1,56],[2,24],[3,13],[4,7]]:[[1,50],[2,27],[3,15],[4,8]])) for(let i=0;i<count;i++)sizes.push(size);
  const shuffleSizes=()=>{for(let i=sizes.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[sizes[i],sizes[j]]=[sizes[j],sizes[i]];}};
  shuffleSizes();let sizeIndex=0;
  const candidates=[];
  for(let y=2;y<MAP_RADIUS-2;y++)for(let x=2;x<MAP_RADIUS-2;x++)candidates.push({x,y,order:rand(),gap:L2?3.5+rand()*5.5:5+rand()*3});
  candidates.sort((a,b)=>a.order-b.order);
  for(const center of candidates){
    if(anchors.some(p=>Math.hypot(p.x-center.x,p.y-center.y)<Math.max(p.gap,center.gap)))continue;
    const group=[{x:center.x,y:center.y}];
    const size=sizes[sizeIndex];
    for(let tries=0;tries<30&&group.length<size;tries++){
      const p=group[Math.floor(rand()*group.length)];
      let v;
      if(L2){
        // any spot up to two tiles away, also diagonal or with a gap in between
        const dx=Math.floor(rand()*5)-2,dy=Math.floor(rand()*5)-2;
        if(!dx&&!dy)continue;
        v={x:p.x+dx,y:p.y+dy};
        if(v.x<1||v.y<1||Math.hypot(v.x-center.x,v.y-center.y)>3||group.some(w=>w.x===v.x&&w.y===v.y))continue;
        const has=(x,y)=>(x===v.x&&y===v.y)||group.some(w=>w.x===x&&w.y===y);
        let block=false;
        for(const [ox,oy] of [[0,0],[-1,0],[0,-1],[-1,-1]]){const x=v.x+ox,y=v.y+oy;if(has(x,y)&&has(x+1,y)&&has(x,y+1)&&has(x+1,y+1))block=true;}
        if(block)continue;
        // no three in a straight touching row either
        if(group.filter(w=>Math.abs(w.x-v.x)<=1&&Math.abs(w.y-v.y)<=1).length>1)continue;
      }else{
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]],d=dirs[Math.floor(rand()*4)];
        v={x:p.x+d[0],y:p.y+d[1]};
        if(v.x<1||v.y<1||Math.hypot(v.x-center.x,v.y-center.y)>2||group.some(w=>w.x===v.x&&w.y===v.y))continue;
      }
      group.push(v);
    }
    if(group.length!==size)continue;
    const orbit=[0,1,2,3].map(q=>group.map(p=>rotate(p.x,p.y,q)));
    const all=orbit.flat();
    if(!all.every(valid))continue;
    if(all.some(p=>placed.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<3)))continue;
    if(orbit.some((g,i)=>g.some(p=>orbit.slice(0,i).flat().some(w=>Math.hypot(w.x-p.x,w.y-p.y)<3))))continue;
    anchors.push(center);
    sizeIndex++;if(sizeIndex===sizes.length){sizeIndex=0;shuffleSizes();}
    group.forEach(p=>{
      const tier=campTier(p.x,p.y),kind=CAMPS_PER_QUARTER[tier]++ % CAMP_TIERS[tier].kinds.length;
      for(let q=0;q<4;q++){
        const spot=rotate(p.x,p.y,q);placed.push(spot);
        rows[MAP_RADIUS-spot.y][spot.x+MAP_RADIUS]="n";CAMP_KIND_AT[spot.x+"|"+spot.y]=kind;
      }
    });
  }
  if (LM_VISIBLE) for (const l of LANDMARKS) rows[MAP_RADIUS - l.y][l.x + MAP_RADIUS] = "l";
  for (let i = 0; i < rows.length; i++) MAP_ROWS[i] = rows[i].join("");
  return placed.length;
}

  const rotate=(x,y,q)=>q===0?{x,y}:q===1?{x:-y,y:x}:q===2?{x:-x,y:-y}:{x:y,y:-x};

  const shuffleSizes=()=>{for(let i=sizes.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[sizes[i],sizes[j]]=[sizes[j],sizes[i]];}};

function setLandmarksVisible(on) {
  LM_VISIBLE = !!on;
  for (const l of LANDMARKS) {
    const row = MAP_ROWS[MAP_RADIUS - l.y];
    const tile = LM_VISIBLE ? "l" : BASE_ROWS[MAP_RADIUS - l.y][l.x + MAP_RADIUS];
    MAP_ROWS[MAP_RADIUS - l.y] = row.slice(0, l.x + MAP_RADIUS) + tile + row.slice(l.x + MAP_RADIUS + 1);
  }
}

function pylonAtXY(x, y) {
  return PYLONS.find((p) => p.x === x && p.y === y) || null;
}

function terrainAt(x, y) {
  if (Math.abs(x) > MAP_RADIUS || Math.abs(y) > MAP_RADIUS) return "x";
  return MAP_ROWS[MAP_RADIUS - y][x + MAP_RADIUS];
}

function campTier(x, y) {
  const dist = Math.hypot(x, y);
  for (let i = 0; i < CAMP_TIERS.length; i++) if (dist <= CAMP_TIERS[i].maxDist) return i;
  return CAMP_TIERS.length - 1;
}

function campKind(x, y) {
  const kinds = CAMP_TIERS[campTier(x, y)].kinds;
  const at = CAMP_KIND_AT[x + "|" + y];
  if (at !== undefined) return kinds[at];
  return kinds[Math.min(kinds.length - 1, Math.floor(hash3(x, y, 91) * kinds.length))];
}

function freshCamp(x, y) {
  const kind = campKind(x, y);
  const troops = {};
  let seed = 31;
  for (const key in kind.units) {
    const [min, max] = kind.units[key];
    troops[key] = Math.max(1, min + Math.floor(hash3(x, y, seed++ + MAP_SEED * 101) * (max - min + 1)));
  }
  const treasure = {};
  for (const r of RESOURCES) treasure[r] = Math.round((kind.treasure[r] || 0) * campLootScale());
  return { troops, treasure };
}

module.exports = { baseTerrainAt, campKind, campLootScale, campTier, canonical, freshCamp, generateTerrain, hash3, landmarkAtXY, landmarkByKey, mulberry32, pylonAtXY, quarterOf, rebuildCamps, ridge, rotate, setLandmarksVisible, shuffleSizes, terrainAt, turnAround, valueNoise };