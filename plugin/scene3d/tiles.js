import * as THREE from 'three';

// Grid tiles with automatic neighbour connection. Each cell holds one tile
// type; wall-like tiles pick their segments from the four neighbour bits, so
// corners, ends, tees and crossings need no extra AI input.
export const TILE_TYPES = ['floor', 'wall', 'door', 'window', 'roof', 'fence', 'stair', 'pillar'];
export const WALL_TILES = new Set(['wall', 'door', 'window', 'fence']);
export const TILE_LABELS = {
  floor: '地板', wall: '墙', door: '门', window: '窗', roof: '屋顶', fence: '栅栏', stair: '楼梯', pillar: '柱子',
};
const GRAY = '#aeb3bc', DOOR = '#8a7a66', GLASS = '#9fc4d8', ROOF = '#7d828a';
const HEIGHT = 3, THICK = 0.2;

const DIRS = [
  { bit: 1, dx: 0, dz: -1 }, // north
  { bit: 2, dx: 1, dz: 0 },  // east
  { bit: 4, dx: 0, dz: 1 },  // south
  { bit: 8, dx: -1, dz: 0 }, // west
];

export function tileKey(cell) {
  return cell.join(',');
}

export function isWallTile(type) {
  return WALL_TILES.has(type);
}

export function wallMask(cell, hasTile) {
  const [x, y, z] = cell;
  let mask = 0;
  for (const dir of DIRS) if (hasTile([x + dir.dx, y, z + dir.dz])) mask |= dir.bit;
  return mask;
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color: color || GRAY, roughness: .85 });
}

function box(w, h, d, x, y, z, mat) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0x3a3f46, transparent: true, opacity: .55 })
  ));
  return mesh;
}

// A wall tile renders one half-metre segment from the cell centre toward each
// connected neighbour. Two adjacent tiles meet exactly on the shared edge.
function wallSegments(group, mask, type, color) {
  const mat = material(color);
  const h = type === 'fence' ? 1 : HEIGHT;
  const parts = [];
  for (const dir of DIRS) {
    if (!(mask & dir.bit)) continue;
    const alongX = dir.dx !== 0;
    const geoW = alongX ? .5 : THICK;
    const geoD = alongX ? THICK : .5;
    const cx = dir.dx * .25, cz = dir.dz * .25;
    parts.push(box(geoW, h, geoD, cx, h / 2, cz, mat));
    if (type === 'door' || type === 'window') {
      const panel = type === 'door'
        ? box(alongX ? .46 : THICK * .6, 2, alongX ? THICK * .6 : .46, cx, 1, cz, material(DOOR))
        : box(alongX ? .5 : .04, 1, alongX ? .04 : .5, cx, 1.5, cz, material(GLASS));
      panel.position.y = type === 'door' ? 1 : 1.5;
      parts.push(panel);
    }
  }
  if (!parts.length) parts.push(box(THICK, h, THICK, 0, h / 2, 0, mat));
  group.add(...parts);
}

export function buildTile({ type, cell, mask = 0, color }) {
  const [x, y, z] = cell;
  const group = new THREE.Group();
  const baseY = y * HEIGHT;
  if (type === 'floor' || type === 'roof') {
    const mat = material(type === 'roof' ? (color || ROOF) : color);
    group.add(box(1, .2, 1, 0, .1, 0, mat));
  } else if (type === 'stair') {
    const mat = material(color);
    group.add(box(1, .33, 1, 0, .165, -.34, mat));
    group.add(box(1, .33, 1, 0, .495, 0, mat));
    group.add(box(1, .33, 1, 0, .825, .34, mat));
  } else if (type === 'pillar') {
    group.add(box(.3, HEIGHT, .3, 0, HEIGHT / 2, 0, material(color)));
  } else {
    // Wall-like tiles also carry a floor slab so a room's ground stays continuous.
    group.add(box(1, .2, 1, 0, .1, 0, material('#c9c2b6')));
    wallSegments(group, mask, type, color);
  }
  group.position.set(x, baseY, z);
  group.userData = { type, cell: [x, y, z], mask };
  return group;
}

export function tileHasGeometry(type) {
  return TILE_TYPES.includes(type);
}
