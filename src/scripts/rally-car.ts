// PS2-era turntable for the rally page's Set Up screen. Renders the shared
// Tiguan at the 640x480 screen's native resolution with no antialiasing,
// cheap per-material lighting, a fake reflection cube, and a blob shadow.
import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { blobShadow, loadTiguan } from './rally-tiguan';

// Hub centers in model space, measured from the source model
const WHEELS: [number, number, number][] = [
  [-0.79, 0.35, -1.398],
  [0.79, 0.35, -1.398],
  [-0.78, 0.35, 1.398],
  [0.78, 0.35, 1.398],
];

export interface CarView {
  dispose(): void;
}

export async function mountCar(
  canvas: HTMLCanvasElement,
  lines: SVGPathElement,
  dots: [SVGCircleElement, SVGCircleElement],
  layout: { barY: number; stemX: number; stemY: number },
): Promise<CarView> {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, canvas.width / canvas.height, 0.1, 50);
  camera.position.set(0, 1.55, 5.9);
  camera.lookAt(0, 0.6, 0);

  scene.add(new AmbientLight(0xffffff, 0.85));
  const key = new DirectionalLight(0xfff6e8, 1.55);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xbcd2e0, 0.6);
  rim.position.set(-4, 2, -5);
  scene.add(rim);

  const model = await loadTiguan();

  // The source model is centered on its wheelbase with the ground at y=0
  const turntable = new Group();
  turntable.add(model.clone(), blobShadow(4.7, 2.15));
  scene.add(turntable);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let angle = -0.55;
  let dragging = false;
  let lastX = 0;
  let idleSince = performance.now();

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    // clientX is in screen px; the stage is scaled, so normalize by canvas size on screen
    const w = canvas.getBoundingClientRect().width || canvas.width;
    angle += ((e.clientX - lastX) / w) * Math.PI * 1.6;
    lastX = e.clientX;
  };
  const onUp = () => {
    dragging = false;
    idleSince = performance.now();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const hubs = WHEELS.map((w) => new Vector3(...w));
  const world = new Vector3();
  const proj = new Vector3();

  function updateLines() {
    const pts = hubs.map((h) => {
      world.copy(h).applyMatrix4(turntable.matrixWorld);
      const dist = world.distanceTo(camera.position);
      proj.copy(world).project(camera);
      return {
        x: (proj.x * 0.5 + 0.5) * canvas.width,
        y: (-proj.y * 0.5 + 0.5) * canvas.height,
        dist,
      };
    });
    // The two hubs nearest the camera are the visible side
    const near = pts.sort((a, b) => a.dist - b.dist).slice(0, 2).sort((a, b) => a.x - b.x);
    const { barY, stemX, stemY } = layout;
    const [a, b] = near;
    lines.setAttribute(
      'd',
      `M${a.x.toFixed(1)} ${a.y.toFixed(1)} V${barY} M${b.x.toFixed(1)} ${b.y.toFixed(1)} V${barY} ` +
        `M${Math.min(a.x, stemX).toFixed(1)} ${barY} H${Math.max(b.x, stemX).toFixed(1)} M${stemX} ${barY} V${stemY}`,
    );
    dots[0].setAttribute('cx', a.x.toFixed(1));
    dots[0].setAttribute('cy', a.y.toFixed(1));
    dots[1].setAttribute('cx', b.x.toFixed(1));
    dots[1].setAttribute('cy', b.y.toFixed(1));
  }

  let raf = 0;
  let prev = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    // Skip work while the Set Up pane is hidden or the tab is in the background
    if (document.hidden || canvas.offsetParent === null) return;
    if (!dragging && !reduceMotion && now - idleSince > 1200) angle += dt * 0.4;
    turntable.rotation.y = angle;
    turntable.updateMatrixWorld();
    renderer.render(scene, camera);
    updateLines();
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      renderer.dispose();
    },
  };
}
