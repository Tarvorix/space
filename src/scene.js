import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 20, 40);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  // Trackpad-friendly: left-drag rotates camera (InputManager disables when dragging ship)
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  const ambient = new THREE.AmbientLight(0x666666);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 20, 10);
  scene.add(directional);

  const gridXZ = new THREE.GridHelper(60, 60, 0x222244, 0x111122);
  scene.add(gridXZ);

  const gridXY = new THREE.GridHelper(60, 60, 0x442222, 0x221111);
  gridXY.rotation.x = Math.PI / 2;
  gridXY.position.z = -30;
  scene.add(gridXY);

  const gridYZ = new THREE.GridHelper(60, 60, 0x224422, 0x112211);
  gridYZ.rotation.z = Math.PI / 2;
  gridYZ.position.x = -30;
  scene.add(gridYZ);

  scene.add(new THREE.AxesHelper(5));

  [6, 18, 30].forEach((r, i) => {
    const geo = new THREE.SphereGeometry(r, 24, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: [0x333366, 0x336633, 0x663333][i],
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    scene.add(new THREE.Mesh(geo, mat));
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls };
}
