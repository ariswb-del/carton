import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* Mise en scène commune : lumière studio, caméra cadrée sur l'objet.
   - snapshot() rend une image fixe (vignettes du jeu) avec un seul moteur partagé ;
   - mountViewer() crée la vue manipulable au doigt pour la fiche d'un disque. */

function lights(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();
  const key = new THREE.DirectionalLight('#ffffff', 1.25); key.position.set(-80, 140, 180); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 0.7); rim.position.set(120, 60, -160); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a3a3a', 0.5));
}

function frame(camera: THREE.PerspectiveCamera, obj: THREE.Object3D, margin = 1.18) {
  const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  const dist = (sphere.radius * margin) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, 0, dist);
  camera.near = dist / 20; camera.far = dist * 4;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return dist;
}

let shared: THREE.WebGLRenderer | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string | null>>();

export function snapshot(key: string, build: () => Promise<THREE.Group>, pose: { x: number; y: number }, size = 560): Promise<string | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const job = queue.then(async () => {
    try {
      if (!shared) {
        shared = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        shared.setPixelRatio(1);
        shared.outputColorSpace = THREE.SRGBColorSpace;
        shared.toneMapping = THREE.NeutralToneMapping;
      }
      shared.setSize(size, size, false);
      const scene = new THREE.Scene();
      lights(scene, shared);
      const obj = await build();
      obj.rotation.set(THREE.MathUtils.degToRad(pose.x), THREE.MathUtils.degToRad(pose.y), 0);
      scene.add(obj);
      const cam = new THREE.PerspectiveCamera(28, 1);
      frame(cam, obj, 1.05);
      shared.setClearColor(0x000000, 0);
      shared.render(scene, cam);
      const url = shared.domElement.toDataURL('image/webp', 0.9);
      obj.userData.dispose?.();
      scene.environment?.dispose();
      return url;
    } catch {
      return null;
    }
  });
  queue = job;
  cache.set(key, job);
  return job;
}

export type Viewer = { flip: () => void; reset: () => void; setOpen: (o: boolean) => void; dispose: () => void };

export async function mountViewer(el: HTMLElement, build: () => Promise<THREE.Group>, pose: { x: number; y: number }): Promise<Viewer> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  lights(scene, renderer);
  const obj = await build();
  const pivot = new THREE.Group();
  pivot.add(obj);
  obj.rotation.set(THREE.MathUtils.degToRad(pose.x), THREE.MathUtils.degToRad(pose.y), 0);
  scene.add(pivot);

  const cam = new THREE.PerspectiveCamera(28, 1);
  const dist = frame(cam, obj, 1.12);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = dist * 0.55; controls.maxDistance = dist * 1.6;
  controls.rotateSpeed = 0.9;

  const resize = () => {
    const w = el.clientWidth || 300;
    renderer.setSize(w, w, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    cam.aspect = 1; cam.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(el);

  let target = 0, raf = 0;
  const tick = () => {
    pivot.rotation.y += (target - pivot.rotation.y) * 0.12;
    obj.userData.update?.();
    controls.update();
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    flip: () => { target += Math.PI; },
    setOpen: (o: boolean) => { obj.userData.setOpen?.(o); },
    reset: () => { target = Math.round(target / (2 * Math.PI)) * 2 * Math.PI; controls.reset(); },
    dispose: () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      obj.userData.dispose?.(); scene.environment?.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
