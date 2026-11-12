import * as THREE from 'three';

// Modular building pieces. Origins are the cell's bottom centre; the grid is
// 1 m per cell with a 3 m storey height. Wall-like pieces sit on a cell edge
// (chosen by facing) so one cell can hold a floor plus up to four walls.
const GRAY = '#aeb3bc', GLASS = '#9fc4d8', DOOR = '#8a7a66', ROOF = '#7d828a';
const DEFS = {
  floor: { slot: 'floor', label: '地板', parts: [[1, .2, 1, 0, .1, 0, GRAY]] },
  slab: { slot: 'floor', label: '楼板', parts: [[1, .2, 1, 0, .1, 0, GRAY]] },
  wall_3_solid: { slot: 'wall', edge: true, label: '3m 实墙', parts: [[1, 3, .2, 0, 1.5, 0, GRAY]] },
  wall_3_window_closed: {
    slot: 'wall', edge: true, label: '3m 墙·窗（关）',
    parts: [[1, 1, .2, 0, .5, 0, GRAY], [1, 1, .2, 0, 2.5, 0, GRAY], [.1, 1, .2, -.45, 1.5, 0, GRAY], [.1, 1, .2, .45, 1.5, 0, GRAY], [.8, .9, .04, 0, 1.5, 0, GLASS]],
  },
  wall_3_window_open: {
    slot: 'wall', edge: true, label: '3m 墙·窗（开）',
    parts: [[1, 1, .2, 0, .5, 0, GRAY], [1, 1, .2, 0, 2.5, 0, GRAY], [.1, 1, .2, -.45, 1.5, 0, GRAY], [.1, 1, .2, .45, 1.5, 0, GRAY]],
  },
  wall_3_door_closed: {
    slot: 'wall', edge: true, label: '3m 墙·门（关）',
    parts: [[1, 1, .2, 0, 2.5, 0, GRAY], [.1, 2, .2, -.45, 1, 0, GRAY], [.1, 2, .2, .45, 1, 0, GRAY], [.78, 2, .06, 0, 1, 0, DOOR]],
  },
  wall_3_door_open: {
    slot: 'wall', edge: true, label: '3m 墙·门（开）',
    parts: [[1, 1, .2, 0, 2.5, 0, GRAY], [.1, 2, .2, -.45, 1, 0, GRAY], [.1, 2, .2, .45, 1, 0, GRAY], [.06, 2, .78, -.4, 1, .49, DOOR]],
  },
  wall_3_doorway: {
    slot: 'wall', edge: true, label: '3m 门洞',
    parts: [[1, 1, .2, 0, 2.5, 0, GRAY], [.1, 2, .2, -.45, 1, 0, GRAY], [.1, 2, .2, .45, 1, 0, GRAY]],
  },
  wall_2_solid: { slot: 'wall', edge: true, label: '2m 围墙', parts: [[1, 2, .2, 0, 1, 0, GRAY]] },
  wall_1_solid: { slot: 'wall', edge: true, label: '1m 矮墙', parts: [[1, 1, .2, 0, .5, 0, GRAY]] },
  fence: {
    slot: 'wall', edge: true, label: '栅栏',
    parts: [[.08, 1, .08, -.42, .5, 0, GRAY], [.08, 1, .08, .42, .5, 0, GRAY], [.9, .08, .06, 0, .7, 0, GRAY], [.9, .08, .06, 0, .35, 0, GRAY]],
  },
  roof_flat: { slot: 'roof', label: '平顶', parts: [[1, .2, 1, 0, .1, 0, ROOF]] },
  roof_slope: { slot: 'roof', label: '单坡顶', parts: [[1, .12, 1.16, 0, .34, 0, ROOF, 24]] },
  stair_straight: {
    slot: 'floor', label: '直跑楼梯',
    parts: [[1, 1, 1, 0, .5, -1, GRAY], [1, 1, 1, 0, 1.5, 0, GRAY], [1, 1, 1, 0, 2.5, 1, GRAY]],
  },
  pillar: { slot: 'wall', label: '柱子', parts: [[.3, 3, .3, 0, 1.5, 0, GRAY]] },
  bed_double: {
    slot: 'furniture', label: '双人床',
    parts: [[1.8, .12, 2, 0, .3, 0, '#8a7a66'], [1.8, .22, 2, 0, .45, 0, '#e8e4dc'], [.7, .14, .45, -.5, .6, -.7, '#ffffff'], [.7, .14, .45, .5, .6, -.7, '#ffffff']],
  },
  nightstand: { slot: 'furniture', label: '床头柜', parts: [[.5, .5, .5, 0, .25, 0, '#8a7a66']] },
  wardrobe: { slot: 'furniture', label: '衣柜', parts: [[1, 2, .6, 0, 1, 0, '#8a7a66'], [.04, 1.9, .02, 0, 1, .31, '#6f6152']] },
  desk: {
    slot: 'furniture', label: '书桌',
    parts: [[1, .05, .6, 0, .75, 0, '#a08a72'], [.05, .75, .05, -.45, .375, -.25, '#8a7a66'], [.05, .75, .05, .45, .375, -.25, '#8a7a66'], [.05, .75, .05, -.45, .375, .25, '#8a7a66'], [.05, .75, .05, .45, .375, .25, '#8a7a66']],
  },
  chair: {
    slot: 'furniture', label: '椅子',
    parts: [[.5, .05, .5, 0, .45, 0, '#a08a72'], [.5, .5, .05, 0, .7, -.22, '#8a7a66']],
  },
  lamp: {
    slot: 'furniture', label: '台灯',
    parts: [[.12, .35, .12, 0, .175, 0, '#5f6168'], [.28, .16, .28, 0, .43, 0, '#fff6df']],
  },
  rug: { slot: 'furniture', label: '地毯', parts: [[2, .02, 3, 0, .01, 0, '#b8a890']] },
};

export const MODULE_IDS = Object.keys(DEFS);
export const MODULE_LABELS = Object.fromEntries(Object.entries(DEFS).map(([id, def]) => [id, def.label]));
export const MODULE_LIST = MODULE_IDS.map((id) => ({ id, label: DEFS[id].label, slot: DEFS[id].slot, edge: !!DEFS[id].edge }));

export function isModule(id) {
  return Object.prototype.hasOwnProperty.call(DEFS, id);
}

export function moduleDef(id) {
  return DEFS[id] || null;
}

export function buildModule(id, color) {
  const def = DEFS[id];
  if (!def) return null;
  const group = new THREE.Group();
  for (const [w, h, d, x, y, z, partColor, rotX] of def.parts) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: color || partColor || GRAY, roughness: .85 }));
    mesh.position.set(x, y, z);
    if (rotX) mesh.rotation.x = THREE.MathUtils.degToRad(rotX);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function moduleFacingAngle(facing) {
  return { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 }[facing] ?? 0;
}

export function moduleEdgeOffset(facing) {
  return { n: [0, 0, -.5], s: [0, 0, .5], e: [.5, 0, 0], w: [-.5, 0, 0] }[facing] || [0, 0, 0];
}

export const MODULE_FACINGS = ['n', 'e', 's', 'w'];
