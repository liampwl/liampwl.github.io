// Shared PS2-era treatment of the Tiguan model, used by the Set Up turntable
// and the drivable stage. The model is pre-decimated (~11k tris, 128px
// textures); materials are swapped for cheap Lambert/Phong with a fake
// reflection cube.
import {
  CanvasTexture,
  Color,
  CubeTexture,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MixOperation,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function gradientFace(top: string, bottom: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 16);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 16);
  return c;
}

export function fakeSky() {
  const side = () => gradientFace('#e9f0f2', '#4a5352');
  const tex = new CubeTexture([
    side(), side(),
    gradientFace('#ffffff', '#ffffff'),
    gradientFace('#3b4241', '#3b4241'),
    side(), side(),
  ]);
  tex.needsUpdate = true;
  return tex;
}

export function blobShadow(length: number, width: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, 'rgba(20,24,24,0.55)');
  grad.addColorStop(1, 'rgba(20,24,24,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const mesh = new Mesh(
    new PlaneGeometry(width * 1.5, length * 1.25),
    new MeshLambertMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  return mesh;
}

function ps2Material(src: MeshStandardMaterial, env: CubeTexture): Material {
  const name = src.name ?? '';
  const color = src.color?.clone() ?? new Color(1, 1, 1);
  let mat: Material;
  if (/Car Paint|Gris Ascot/i.test(name)) {
    // Platinum white, the actual car's paint
    mat = new MeshPhongMaterial({
      color: new Color('#e4e1d8'), specular: 0x9a9890, shininess: 42,
      envMap: env, combine: MixOperation, reflectivity: 0.18,
    });
  } else if (/Windows Ext|Black Glossy/i.test(name)) {
    // Opaque tinted glass: there's no interior behind it
    mat = new MeshPhongMaterial({
      color: 0x0b1012, specular: 0x7c8688, shininess: 70,
      envMap: env, combine: MixOperation, reflectivity: 0.12,
    });
  } else if (/Glass/i.test(name)) {
    mat = new MeshLambertMaterial({
      color: 0xdfe8ea, transparent: true, opacity: 0.25,
      envMap: env, combine: MixOperation, reflectivity: 0.5, depthWrite: false,
    });
  } else {
    const lambert = new MeshLambertMaterial({ color, map: src.map ?? null });
    if (/Reflector|Brushed|Chrome/i.test(name)) {
      lambert.envMap = env;
      lambert.combine = MixOperation;
      lambert.reflectivity = 0.3;
    }
    if (src.transparent) {
      lambert.transparent = true;
      lambert.opacity = src.opacity;
    }
    mat = lambert;
  }
  mat.name = name;
  return mat;
}

let cached: Promise<Group> | null = null;

// Resolves to the processed model. Callers that place it in more than one
// scene should clone() it.
export function loadTiguan(onProgress?: (fraction: number) => void): Promise<Group> {
  if (!cached) {
    const env = fakeSky();
    cached = new GLTFLoader()
      .loadAsync('/rally/tiguan.glb', (e) => {
        if (onProgress && e.total) onProgress(e.loaded / e.total);
      })
      .then((gltf) => {
        gltf.scene.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.geometry.deleteAttribute('normal');
          m.geometry.computeVertexNormals();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          const next = mats.map((x) => {
            const std = x as MeshStandardMaterial;
            if (std.map) {
              std.map.colorSpace = SRGBColorSpace;
              std.map.anisotropy = 1;
            }
            return ps2Material(std, env);
          });
          m.material = Array.isArray(m.material) ? next : next[0];
        });
        return gltf.scene;
      });
    cached.catch(() => (cached = null));
  } else if (onProgress) {
    cached.then(() => onProgress(1));
  }
  return cached;
}
