import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CharacterAppearance, Role } from '../types/game.ts';
import { buildCharacterRig, type CharacterRig } from '../three/characterBuilder.ts';

interface CharacterPreview3DProps {
  role: Role;
  appearance: CharacterAppearance;
}

export function CharacterPreview3D({ role, appearance }: CharacterPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<CharacterRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    let isSoftwareGl = false;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } else {
      isSoftwareGl = true;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const w = container.clientWidth || 300;
    const h = container.clientHeight || 340;
    renderer.setSize(w, h);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 30);
    camera.position.set(0, 1.45, 3.35);
    camera.lookAt(0, 0.95, 0);

    const hemi = new THREE.HemisphereLight('#a5c4f5', '#2a1d19', 0.9);
    const key = new THREE.DirectionalLight('#ffd394', 1.8);
    key.position.set(2.5, 3.5, 3.5);
    const rim = new THREE.DirectionalLight('#60a5fa', 0.75);
    rim.position.set(-2.5, 2.5, -2.5);
    scene.add(hemi, key, rim);

    // Pedestal plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.82, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: '#1c2233', roughness: 0.45, metalness: 0.4 }),
    );
    plinth.position.y = -0.06;
    scene.add(plinth);

    const rig = buildCharacterRig(role, appearance, false);
    rigRef.current = rig;
    scene.add(rig.root);

    let angle = 0.35;
    let dragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      angle += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    const onResize = () => {
      const nw = container.clientWidth || 300;
      const nh = container.clientHeight || 340;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      if (!dragging) angle += dt * 0.48;
      if (rigRef.current) {
        rigRef.current.root.rotation.y = angle;
        rigRef.current.torsoGroup.position.y = 0.68 + Math.sin(clock.elapsedTime * 2.2) * 0.015;
      }
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 90);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Hot-swap character rig whenever role or appearance changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const prevY = rigRef.current?.root.rotation.y ?? 0.35;
    if (rigRef.current) {
      scene.remove(rigRef.current.root);
    }
    const nextRig = buildCharacterRig(role, appearance, false);
    nextRig.root.rotation.y = prevY;
    rigRef.current = nextRig;
    scene.add(nextRig.root);
  }, [role, appearance]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[260px] cursor-grab active:cursor-grabbing touch-none-zone"
      aria-label="3D character wardrobe preview"
    />
  );
}
