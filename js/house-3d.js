/* js/house-3d.js — HOUSE LAB 3D massing builder (ES module).
 *
 * Turns a normalized plan (lib/house-estimator.js normalizePlan) into a
 * Three.js scene: floor slabs, walls, windows, a front door, a roof
 * (gable / hip / flat / shed), porches with posts, a garage, and the AC
 * units from the notes sitting exactly where Dad wrote they go.
 * 1 unit = 1 foot. Exports OBJ + PNG snapshots.
 */
import * as THREE from 'three';
import { OrbitControls } from '/lib/vendor/three/OrbitControls.js';
import { OBJExporter } from '/lib/vendor/three/OBJExporter.js';

const WALL_T = 0.45;
const SLAB_T = 0.6;

const PALETTE = {
  wall:    0xe9e2d3, wallIn: 0xf4efe6, porch: 0xb98b5a, post: 0xf1ede4, garage: 0xd8d4cc,
  roof:    0x3a3a3a, roofEdge: 0x2a2a2a, glass: 0x8fb8d9, door: 0x7a3b1e, ground: 0x1c1c1c, lot: 0x2b2b2b,
  ac: 0xbfc4c8, acDark: 0x6d7378, slab: 0xd3d0c9, label: '#ffffff'
};
const ROOM_COLORS = {
  living: 0xd9c9a8, kitchen: 0xc9d7b8, dining: 0xd9c9a8, bedroom: 0xc7cfe0, bath: 0xbfe0e0, office: 0xdccbe0,
  laundry: 0xcfd6d9, hall: 0xe3e0d8, closet: 0xe3e0d8, porch: 0xb98b5a, garage: 0xb8b8b8, workshop: 0xd8c3a0, other: 0xe0dcd4
};

export function createViewer (container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 8; controls.maxDistance = 400;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(60, 90, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 400 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(600, 60, 0x444444, 0x2e2e2e); grid.position.y = 0; scene.add(grid);

  const house = new THREE.Group(); scene.add(house);
  let roofGroup = null, labelsGroup = null, showRoof = true, showLabels = true, current = null, center = new THREE.Vector3();

  function resize () {
    const w = container.clientWidth || 640, h = container.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();

  function clear (g) { while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.material) o.material.dispose(); }); } }

  function box (w, h, d, color, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 }));
    m.castShadow = true; m.receiveShadow = true; m.name = opts.name || '';
    return m;
  }
  // Box helper: position by min corner (x,y=level base,z) rather than centre.
  function place (mesh, x, y, z, w, h, d) { mesh.position.set(x + w / 2, y + h / 2, z + d / 2); return mesh; }

  function label (text, x, y, z, scale = 1) {
    const c = document.createElement('canvas'); const ctx = c.getContext('2d');
    ctx.font = '600 44px Space Grotesk, system-ui, sans-serif';
    const tw = Math.ceil(ctx.measureText(text).width) + 40; c.width = tw; c.height = 72;
    ctx.font = '600 44px Space Grotesk, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(0, 0, tw, 72, 18); ctx.fill();
    ctx.fillStyle = PALETTE.label; ctx.textBaseline = 'middle'; ctx.fillText(text, 20, 38);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(tw / 44 * 1.2 * scale, 72 / 44 * 1.2 * scale, 1); s.position.set(x, y, z); s.renderOrder = 10;
    return s;
  }

  function roofFor (plan, bbox, baseY) {
    const g = new THREE.Group(); g.name = 'roof';
    const over = 1.5;
    const w = bbox.w + over * 2, d = bbox.d + over * 2;
    const x0 = bbox.minX - over, z0 = bbox.minY - over;
    const rise = plan.roof.pitch / 12;
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 0.9, side: THREE.DoubleSide });
    const type = plan.roof.type;
    if (type === 'flat') {
      const slab = place(box(w, 0.8, d, PALETTE.roof), x0, baseY, z0, w, 0.8, d); g.add(slab);
      const par = 1.2;
      g.add(place(box(w, par, WALL_T, PALETTE.wall), x0, baseY + 0.8, z0, w, par, WALL_T));
      g.add(place(box(w, par, WALL_T, PALETTE.wall), x0, baseY + 0.8, z0 + d - WALL_T, w, par, WALL_T));
      g.add(place(box(WALL_T, par, d, PALETTE.wall), x0, baseY + 0.8, z0, WALL_T, par, d));
      g.add(place(box(WALL_T, par, d, PALETTE.wall), x0 + w - WALL_T, baseY + 0.8, z0, WALL_T, par, d));
      return g;
    }
    if (type === 'shed') {
      // Right-triangle profile: high at the front (z0), low at the back.
      const h = Math.max(1.5, d * rise * 0.6);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(d, 0); shape.lineTo(0, h); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      // rotate -90° about Y: local x → world z, local z (extrude) → world -x
      m.rotation.set(0, -Math.PI / 2, 0); m.position.set(x0 + w, baseY, z0);
      g.add(m);
      return g;
    }
    // gable or hip — ridge runs along the longer side
    const alongX = w >= d;
    const span = alongX ? d : w, len = alongX ? w : d;
    const h = (span / 2) * rise;
    if (type === 'gable') {
      const shape = new THREE.Shape(); shape.moveTo(-span / 2, 0); shape.lineTo(span / 2, 0); shape.lineTo(0, h); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      if (alongX) { m.rotation.y = Math.PI / 2; m.position.set(x0, baseY, z0 + d / 2); }
      else        { m.position.set(x0 + w / 2, baseY, z0); }
      g.add(m);
      // gable end walls are the extrude caps already; add a ridge cap line for looks
      const ridge = alongX ? place(box(len, 0.3, 0.6, PALETTE.roofEdge), x0, baseY + h - 0.1, z0 + d / 2 - 0.3, len, 0.3, 0.6)
                           : place(box(0.6, 0.3, len, PALETTE.roofEdge), x0 + w / 2 - 0.3, baseY + h - 0.1, z0, 0.6, 0.3, len);
      g.add(ridge);
      return g;
    }
    // hip: 4 eave corners + 2 ridge points
    const ridgeLen = Math.max(0, len - span);
    const cx = x0 + w / 2, cz = z0 + d / 2;
    const r1 = alongX ? [cx - ridgeLen / 2, h, cz] : [cx, h, cz - ridgeLen / 2];
    const r2 = alongX ? [cx + ridgeLen / 2, h, cz] : [cx, h, cz + ridgeLen / 2];
    const A = [x0, 0, z0], B = [x0 + w, 0, z0], C = [x0 + w, 0, z0 + d], D = [x0, 0, z0 + d];
    const tris = alongX
      ? [[A, B, r2], [A, r2, r1], [B, C, r2], [C, D, r1], [C, r1, r2], [D, A, r1]]
      : [[A, B, r1], [B, C, r2], [B, r2, r1], [C, D, r2], [D, A, r1], [D, r1, r2]];
    const pos = []; for (const t of tris) for (const v of t) pos.push(...v);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.position.y = baseY; m.castShadow = true; g.add(m);
    return g;
  }

  function build (plan) {
    current = plan;
    clear(house); roofGroup = null; labelsGroup = new THREE.Group(); labelsGroup.name = 'labels';
    const H = plan.wall_height;
    const core = plan.rooms.filter(r => r.type !== 'porch' && r.type !== 'garage');
    const bboxAll = bounds(core.length ? core : plan.rooms);
    center.set(bboxAll.minX + bboxAll.w / 2, H / 2, bboxAll.minY + bboxAll.d / 2);

    const perLevel = {};
    for (const r of plan.rooms) (perLevel[r.level] ||= []).push(r);
    const levels = Object.keys(perLevel).map(Number).sort();

    for (const level of levels) {
      const rooms = perLevel[level];
      const coreL = rooms.filter(r => r.type !== 'porch' && r.type !== 'garage');
      const bb = bounds(coreL.length ? coreL : rooms);
      const y0 = level * (H + SLAB_T);
      for (const r of rooms) {
        const isPorch = r.type === 'porch', isGarage = r.type === 'garage';
        const color = ROOM_COLORS[r.type] || ROOM_COLORS.other;
        if (isPorch) {
          const g = new THREE.Group(); g.name = 'porch:' + r.name;
          const deckY = 1.0;
          g.add(place(box(r.w, 0.5, r.d, PALETTE.porch), r.x, y0 + deckY - 0.5, r.y, r.w, 0.5, r.d));
          // posts on the two outer corners + midpoints
          const postH = H - 1;
          const outerZ = r.side === 'front' ? r.y : r.side === 'back' ? r.y + r.d - 0.5 : null;
          const posts = [];
          if (outerZ != null) { posts.push([r.x + 0.2, outerZ], [r.x + r.w - 0.7, outerZ]); if (r.w > 14) posts.push([r.x + r.w / 2 - 0.25, outerZ]); }
          else { const outerX = r.side === 'left' ? r.x : r.x + r.w - 0.5; posts.push([outerX, r.y + 0.2], [outerX, r.y + r.d - 0.7]); }
          for (const [px, pz] of posts) g.add(place(box(0.5, postH, 0.5, PALETTE.post), px, y0 + deckY, pz, 0.5, postH, 0.5));
          // porch roof — thin slab, slightly sloped away from the house
          const pr = box(r.w + 1, 0.4, r.d + 1, PALETTE.roof); place(pr, r.x - 0.5, y0 + deckY + postH, r.y - 0.5, r.w + 1, 0.4, r.d + 1);
          pr.rotation.x = r.side === 'back' ? 0.08 : r.side === 'front' ? -0.08 : 0; pr.rotation.z = r.side === 'left' ? -0.08 : r.side === 'right' ? 0.08 : 0;
          g.add(pr);
          // railing
          if (outerZ != null) g.add(place(box(r.w, 0.15, 0.15, PALETTE.post), r.x, y0 + deckY + 3, outerZ + 0.2, r.w, 0.15, 0.15));
          house.add(g);
          if (showLabels) labelsGroup.add(label(r.name, r.x + r.w / 2, y0 + deckY + 2.2, r.y + r.d / 2, 0.9));
          continue;
        }
        // floor slab
        const slab = place(box(r.w, SLAB_T, r.d, isGarage ? PALETTE.garage : color), r.x, y0, r.y, r.w, SLAB_T, r.d); slab.name = 'floor:' + r.name; house.add(slab);
        // walls — outer faces colored as exterior, all interior tinted
        const wy = y0 + SLAB_T;
        const wallColor = isGarage ? PALETTE.garage : PALETTE.wall;
        const walls = [
          ['front', place(box(r.w, H, WALL_T, wallColor), r.x, wy, r.y, r.w, H, WALL_T)],
          ['back',  place(box(r.w, H, WALL_T, wallColor), r.x, wy, r.y + r.d - WALL_T, r.w, H, WALL_T)],
          ['left',  place(box(WALL_T, H, r.d, wallColor), r.x, wy, r.y, WALL_T, H, r.d)],
          ['right', place(box(WALL_T, H, r.d, wallColor), r.x + r.w - WALL_T, wy, r.y, WALL_T, H, r.d)]
        ];
        for (const [side, w] of walls) { w.name = `wall:${r.name}:${side}`; house.add(w); }
        // windows on exterior-facing walls, door on the front-most room nearest centre
        const eps = 0.3;
        const ext = { front: Math.abs(r.y - bb.minY) < eps, back: Math.abs(r.y + r.d - bb.maxY) < eps, left: Math.abs(r.x - bb.minX) < eps, right: Math.abs(r.x + r.w - bb.maxX) < eps };
        const winMat = new THREE.MeshStandardMaterial({ color: PALETTE.glass, metalness: 0.4, roughness: 0.2 });
        const addWin = (cx, cz, alongX, ww = 3.2, wh = 4) => {
          const g = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ww : 0.2, wh, alongX ? 0.2 : ww), winMat);
          g.position.set(cx, wy + 3 + wh / 2, cz); house.add(g);
        };
        if (!isGarage && r.type !== 'closet' && r.type !== 'hall') {
          if (ext.front && r.w > 5) addWin(r.x + r.w / 2, r.y + 0.02, true);
          if (ext.back && r.w > 5)  addWin(r.x + r.w / 2, r.y + r.d - 0.02, true);
          if (ext.left && r.d > 5)  addWin(r.x + 0.02, r.y + r.d / 2, false);
          if (ext.right && r.d > 5) addWin(r.x + r.w - 0.02, r.y + r.d / 2, false);
        }
        if (isGarage) {
          const gd = new THREE.Mesh(new THREE.BoxGeometry(Math.min(r.w - 2, 16), 7, 0.25), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
          const front = r.side === 'front' ? r.y : r.y; gd.position.set(r.x + r.w / 2, wy + 3.5, front - 0.05); house.add(gd);
        }
        if (showLabels) labelsGroup.add(label(`${r.name} ${r.w}×${r.d}`, r.x + r.w / 2, wy + H + 0.6 + (level ? 0 : 0), r.y + r.d / 2, 0.85));
      }
      // front door: ground level, room touching front edge nearest bbox centre x
      if (level === 0 && coreL.length) {
        const frontRooms = coreL.filter(r => Math.abs(r.y - bb.minY) < 0.3).sort((a, b) => Math.abs(a.x + a.w / 2 - (bb.minX + bb.w / 2)) - Math.abs(b.x + b.w / 2 - (bb.minX + bb.w / 2)));
        const fr = frontRooms[0];
        if (fr) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 0.3), new THREE.MeshStandardMaterial({ color: PALETTE.door }));
          door.position.set(fr.x + Math.min(fr.w - 3, 2.5) + 1.5, y0 + SLAB_T + 3.5, fr.y - 0.05); door.name = 'door:front'; house.add(door);
          // stoop
          house.add(place(box(4, 0.5, 3, PALETTE.slab), fr.x + Math.min(fr.w - 3, 2.5) + 1, 0, fr.y - 3, 4, 0.5, 3));
        }
      }
      // roof on the top level
      if (level === levels[levels.length - 1] && coreL.length) {
        roofGroup = roofFor(plan, bb, y0 + SLAB_T + H);
        roofGroup.visible = showRoof; house.add(roofGroup);
      }
      // garage roof (flat-ish) if garage on this level
      for (const g of rooms.filter(r => r.type === 'garage')) {
        const gr = place(box(g.w + 1, 0.6, g.d + 1, PALETTE.roof), g.x - 0.5, y0 + SLAB_T + H, g.y - 0.5, g.w + 1, 0.6, g.d + 1); house.add(gr);
      }
    }

    // AC units — from Dad's notes. Window units line the house wall on the
    // named porch; splits hang high on the named room's exterior wall with a
    // condenser outside; central = one condenser beside the house.
    const acGroup = new THREE.Group(); acGroup.name = 'ac'; house.add(acGroup);
    const porches = plan.rooms.filter(r => r.type === 'porch');
    let condenserSlot = 0;
    for (const u of plan.features.ac_units) {
      const loc = String(u.location || '').toLowerCase();
      const side = (loc.match(/front|back|left|right|rear/) || ['back'])[0].replace('rear', 'back');
      const porch = porches.find(p => p.side === side) || porches[0];
      for (let i = 0; i < u.count; i++) {
        if (u.type === 'central') {
          const cx = bboxAll.maxX + 1.5, cz = bboxAll.minY + 4 + condenserSlot++ * 4;
          acGroup.add(place(box(3, 2.6, 3, PALETTE.ac, { metalness: 0.3, roughness: 0.5, name: 'ac:central' }), cx, 0, cz, 3, 2.6, 3));
          acGroup.add(fan(cx + 1.5, 2.65, cz + 1.5));
          continue;
        }
        if (u.type === 'split') {
          const room = plan.rooms.find(r => loc.includes(r.name.toLowerCase().split(' ')[0]) && r.type !== 'porch');
          const target = room || core[0]; const lvlY = target ? target.level * (H + SLAB_T) : 0;
          if (target) {
            const wallX = Math.abs(target.x + target.w - bboxAll.maxX) < 0.3 ? target.x + target.w + 0.1 : target.x - 0.6;
            acGroup.add(place(box(0.5, 1.0, 3, 0xf4f4f4, { name: 'ac:split-head' }), wallX, lvlY + SLAB_T + H - 1.6, target.y + target.d / 2 - 1.5, 0.5, 1.0, 3));
          }
          const cx = bboxAll.maxX + 1.5, cz = bboxAll.minY + 4 + condenserSlot++ * 4;
          acGroup.add(place(box(2.8, 2.2, 1.2, PALETTE.ac, { name: 'ac:split-condenser' }), cx, 0, cz, 2.8, 2.2, 1.2));
          continue;
        }
        // window / portable → on the porch deck against the house wall
        const W = 2.2, Hh = 1.5, D = 1.8;
        if (porch) {
          const deckY = porch.level * (H + SLAB_T) + 1.0;
          const n = u.count, gap = (porch.w - n * W) / (n + 1);
          const px = porch.x + gap + i * (W + gap);
          const pz = porch.side === 'back' ? porch.y + 0.5 : porch.side === 'front' ? porch.y + porch.d - D - 0.5 : porch.y + porch.d / 2;
          const unit = place(box(W, Hh, D, PALETTE.ac, { metalness: 0.35, roughness: 0.45, name: 'ac:window' }), px, deckY + (u.type === 'window' ? 3.2 : 0), pz, W, Hh, D);
          acGroup.add(unit);
          const grille = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.7, Hh * 0.6), new THREE.MeshStandardMaterial({ color: PALETTE.acDark }));
          grille.position.set(px + W / 2, unit.position.y, porch.side === 'back' ? pz + D + 0.01 : pz - 0.01); if (porch.side === 'front') grille.rotation.y = Math.PI; acGroup.add(grille);
        } else {
          const cx = bboxAll.minX + 2 + i * (W + 1), cz = bboxAll.maxY + 0.3;
          acGroup.add(place(box(W, Hh, D, PALETTE.ac, { name: 'ac:window' }), cx, SLAB_T + 3.2, cz, W, Hh, D));
        }
      }
    }
    // Callout label for the AC cluster
    if (showLabels && plan.features.ac_units.length) {
      const total = plan.features.ac_units.reduce((s, u) => s + u.count, 0);
      const p = porches[0];
      const lx = p ? p.x + p.w / 2 : bboxAll.minX + 4, lz = p ? p.y + p.d + 1 : bboxAll.maxY + 2;
      labelsGroup.add(label(`${total} AC unit${total > 1 ? 's' : ''}`, lx, 7.5, lz, 0.8));
    }
    labelsGroup.visible = showLabels; house.add(labelsGroup);

    // lot outline
    const lot = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(bboxAll.w + 30, bboxAll.d + 40)), new THREE.LineBasicMaterial({ color: 0x666666 }));
    lot.rotation.x = -Math.PI / 2; lot.position.set(center.x, 0.02, center.z + 3); house.add(lot);

    if (!controls.userHasMoved) frame();
  }

  function fan (x, y, z) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 24), new THREE.MeshStandardMaterial({ color: PALETTE.acDark }));
    f.position.set(x, y, z); return f;
  }

  function bounds (rooms) {
    const minX = Math.min(...rooms.map(r => r.x)), minY = Math.min(...rooms.map(r => r.y));
    const maxX = Math.max(...rooms.map(r => r.x + r.w)), maxY = Math.max(...rooms.map(r => r.y + r.d));
    return { minX, minY, maxX, maxY, w: maxX - minX, d: maxY - minY };
  }

  function frame (view = 'iso') {
    const bb = current ? bounds(current.rooms) : { w: 30, d: 30 };
    const size = Math.max(30, Math.hypot(bb.w, bb.d));
    const dist = size * 1.9;
    const target = center.clone();
    if (view === 'top')   camera.position.set(target.x, dist * 1.2, target.z + 0.01);
    if (view === 'front') camera.position.set(target.x, 8, target.z - dist);
    if (view === 'back')  camera.position.set(target.x, 8, target.z + dist);
    if (view === 'iso')   camera.position.set(target.x - dist * 0.7, dist * 0.55, target.z - dist * 0.75);
    controls.target.copy(target); controls.update();
    controls.userHasMoved = false;
  }
  controls.addEventListener('start', () => { controls.userHasMoved = true; });

  let raf = 0;
  (function loop () { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

  function applyTheme () {
    const light = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#ffffff';
    ground.material.color.set(light ? 0xe8e4dc : PALETTE.ground);
    grid.material.color.set(light ? 0xbbbbbb : 0x444444);
    hemi.groundColor.set(light ? 0xbbbbbb : 0x444444);
  }
  applyTheme(); window.addEventListener('aa:theme', () => setTimeout(applyTheme, 0));

  return {
    setPlan (plan) { build(plan); },
    frame,
    toggleRoof () { showRoof = !showRoof; if (roofGroup) roofGroup.visible = showRoof; return showRoof; },
    toggleLabels () { showLabels = !showLabels; if (labelsGroup) labelsGroup.visible = showLabels; return showLabels; },
    exportOBJ () {
      const vis = labelsGroup && labelsGroup.visible; if (labelsGroup) labelsGroup.visible = false;
      const txt = new OBJExporter().parse(house);
      if (labelsGroup) labelsGroup.visible = vis;
      return '# HOUSE LAB export — units: feet\n' + txt;
    },
    snapshot (w = 640) {
      renderer.render(scene, camera);
      const src = renderer.domElement; const c = document.createElement('canvas');
      const k = w / src.width; c.width = w; c.height = Math.round(src.height * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    },
    dispose () { cancelAnimationFrame(raf); renderer.dispose(); }
  };
}
