import * as THREE from 'three';
import type { CharacterAppearance, Role } from '../types/game.ts';

/**
 * Builds the whole head: smooth skull, a painted face (eyes, brows, nose,
 * mouth, beard), hair, hijab and the head accessories.
 * The head sits at its own origin; the caller positions it on the neck.
 */

const R = 0.215;
const FACE_W = 512;
const FACE_H = 640;
const DEFAULT_EYE = '#33200f';
export const DEFAULT_HIJAB_COLOR = '#c99a9c';

type HeadScale = [number, number, number];

export function headScaleFor(shape: CharacterAppearance['faceShape']): HeadScale {
  switch (shape) {
    case 'square':
      return [1.05, 1.0, 0.96];
    case 'chiseled':
      return [0.97, 1.06, 0.98];
    case 'heart':
      return [0.98, 1.02, 0.95];
    case 'round':
      return [1.03, 1.0, 0.98];
    default:
      return [0.96, 1.05, 0.96];
  }
}

function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

function rgba(hex: string, alpha: number): string {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Paints the front of the face. Canvas x 0..512 spans the face left to right, y 0..640 forehead to chin. */
export function paintFace(role: Role, a: CharacterAppearance): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(role === 'anika' ? 11 : 5);

  const isAnika = role === 'anika';
  const skin = a.skinTone;
  const hair = a.hairColor;
  const eyeColor = a.eyeColor || DEFAULT_EYE;
  const beard = a.beardStyle || 'none';
  const lip = mix(skin, '#5b1f22', isAnika ? 0.42 : 0.5);
  const lipDark = mix(skin, '#2e0f10', 0.75);
  const shade = (alpha: number) => rgba(mix(skin, '#25100a', 0.7), alpha);

  const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // Soft facial structure
  glow(256, 330, 60, mix(skin, '#ffffff', 0.5), 0.16); // nose tip light
  if (isAnika) {
    glow(104, 340, 80, '#d9605f', 0.2); // cheek colour
    glow(408, 340, 80, '#d9605f', 0.2);
  }

  // Beard first, so the lips and moustache sit on top of it
  if (beard !== 'none') {
    const path = new Path2D();
    // Low beard: along the jaw and chin, bare cheeks, never a thin strap
    path.moveTo(-4, 404);
    path.lineTo(10, 420);
    path.bezierCurveTo(30, 500, 80, 540, 150, 548);
    path.bezierCurveTo(200, 552, 226, 500, 256, 486);
    path.bezierCurveTo(286, 500, 312, 552, 362, 548);
    path.bezierCurveTo(432, 540, 482, 500, 502, 420);
    path.lineTo(516, 404);
    path.lineTo(516, FACE_H + 4);
    path.lineTo(-4, FACE_H + 4);
    path.closePath();

    const density = beard === 'full' ? 1 : 0.38;
    ctx.save();
    ctx.globalAlpha = density;
    ctx.fillStyle = hair;
    ctx.fill(path);
    ctx.restore();

    // Soft edge along the cheek line
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < 3200; i++) {
      const x = rand() * FACE_W;
      const y = 400 + rand() * (FACE_H - 400);
      const light = rand() > 0.5;
      ctx.fillStyle = light ? rgba(mix(hair, '#6b5a4c', 0.5), 0.28) : rgba('#000000', 0.3);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();

    // Fuzzy fade just above the beard line
    ctx.save();
    ctx.globalAlpha = density * 0.5;
    ctx.strokeStyle = hair;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 424);
    ctx.bezierCurveTo(36, 498, 84, 534, 150, 541);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(494, 424);
    ctx.bezierCurveTo(476, 498, 428, 534, 362, 541);
    ctx.stroke();
    ctx.restore();

    // Moustache (a little heavier than the cheek beard)
    ctx.save();
    ctx.globalAlpha = Math.min(1, density + 0.25);
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(176, 392);
    ctx.bezierCurveTo(196, 360, 232, 352, 256, 362);
    ctx.bezierCurveTo(280, 352, 316, 360, 336, 392);
    ctx.bezierCurveTo(312, 392, 282, 384, 256, 386);
    ctx.bezierCurveTo(230, 384, 200, 392, 176, 392);
    ctx.fill();
    ctx.restore();
  }

  // Nose: side shading, nostrils and the shadow under the tip
  const noseShade = (x: number) => glow(x, 305, 46, mix(skin, '#25100a', 0.7), 0.2);
  noseShade(222);
  noseShade(290);
  ctx.fillStyle = rgba('#1e0d08', 0.72);
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(256 + s * 24, 338, 12, 7, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = shade(0.4);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(232, 352);
  ctx.quadraticCurveTo(256, 362, 280, 352);
  ctx.stroke();

  // Mouth
  const mouthY = 410;
  if (isAnika) {
    // Wide open smile with teeth
    const mouth = new Path2D();
    mouth.moveTo(172, mouthY - 16);
    mouth.quadraticCurveTo(256, mouthY + 6, 340, mouthY - 16);
    mouth.quadraticCurveTo(256, mouthY + 84, 172, mouthY - 16);
    ctx.fillStyle = lipDark;
    ctx.fill(mouth);
    ctx.save();
    ctx.clip(mouth);
    const teeth = ctx.createLinearGradient(0, mouthY - 16, 0, mouthY + 26);
    teeth.addColorStop(0, '#fbf7f1');
    teeth.addColorStop(1, '#e7dfd5');
    ctx.fillStyle = teeth;
    ctx.fillRect(160, mouthY - 20, 190, 46);
    ctx.strokeStyle = rgba('#9a8a7c', 0.5);
    ctx.lineWidth = 2;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(256 + i * 21, mouthY - 20);
      ctx.lineTo(256 + i * 21, mouthY + 24);
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#b0585a', 0.75);
    ctx.beginPath();
    ctx.ellipse(256, mouthY + 52, 50, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lip;
    ctx.lineWidth = 11;
    ctx.lineJoin = 'round';
    ctx.stroke(mouth);
    // Smile lines
    ctx.strokeStyle = shade(0.2);
    ctx.lineWidth = 4;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(256 + s * 62, 352);
      ctx.quadraticCurveTo(256 + s * 98, 372, 256 + s * 92, mouthY - 14);
      ctx.stroke();
    });
  } else {
    // Calm, slightly lifted smile
    ctx.fillStyle = lip;
    ctx.beginPath();
    ctx.moveTo(196, mouthY - 4);
    ctx.quadraticCurveTo(226, mouthY - 20, 256, mouthY - 12);
    ctx.quadraticCurveTo(286, mouthY - 20, 316, mouthY - 4);
    ctx.quadraticCurveTo(256, mouthY + 6, 196, mouthY - 4);
    ctx.fill();
    ctx.fillStyle = mix(lip, skin, 0.15);
    ctx.beginPath();
    ctx.moveTo(198, mouthY - 3);
    ctx.quadraticCurveTo(256, mouthY + 6, 314, mouthY - 3);
    ctx.quadraticCurveTo(256, mouthY + 34, 198, mouthY - 3);
    ctx.fill();
    ctx.strokeStyle = lipDark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(192, mouthY - 10);
    ctx.quadraticCurveTo(256, mouthY + 12, 320, mouthY - 10);
    ctx.stroke();
  }

  // Eyes
  const drawEye = (s: -1 | 1) => {
    const cx = 256 + s * 112;
    const cy = 238;
    const outer = { x: cx + s * 64, y: cy - 9 };
    const inner = { x: cx - s * 58, y: cy + 5 };
    const upper = (c: CanvasRenderingContext2D) => {
      c.moveTo(inner.x, inner.y);
      c.bezierCurveTo(cx - s * 30, cy - 42, cx + s * 30, cy - 44, outer.x, outer.y);
    };

    const shape = new Path2D();
    shape.moveTo(inner.x, inner.y);
    shape.bezierCurveTo(cx - s * 30, cy - 42, cx + s * 30, cy - 44, outer.x, outer.y);
    shape.bezierCurveTo(cx + s * 30, cy + 24, cx - s * 28, cy + 28, inner.x, inner.y);
    shape.closePath();

    ctx.save();
    ctx.clip(shape);
    const white = ctx.createRadialGradient(cx, cy, 6, cx, cy, 76);
    white.addColorStop(0, '#f6f1ea');
    white.addColorStop(1, '#c9bcb0');
    ctx.fillStyle = white;
    ctx.fillRect(cx - 90, cy - 60, 180, 120);

    // Iris
    const ix = cx - s * 3;
    const iy = cy + 1;
    const iris = ctx.createRadialGradient(ix, iy, 4, ix, iy, 30);
    iris.addColorStop(0, mix(eyeColor, '#8a5a30', 0.35));
    iris.addColorStop(0.7, eyeColor);
    iris.addColorStop(1, mix(eyeColor, '#000000', 0.7));
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ix, iy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#080403';
    ctx.beginPath();
    ctx.arc(ix, iy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(ix - 9, iy - 10, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(ix + 10, iy + 9, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Shadow cast by the upper lid
    const lid = ctx.createLinearGradient(0, cy - 44, 0, cy - 8);
    lid.addColorStop(0, 'rgba(10,4,2,0.5)');
    lid.addColorStop(1, 'rgba(10,4,2,0)');
    ctx.fillStyle = lid;
    ctx.fillRect(cx - 90, cy - 50, 180, 46);
    ctx.restore();

    // Upper lid line with a small flick at the outer corner
    ctx.strokeStyle = '#140a07';
    ctx.lineWidth = isAnika ? 8 : 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    upper(ctx);
    ctx.lineTo(outer.x + s * 9, outer.y - 6);
    ctx.stroke();

    // Lower lid
    ctx.strokeStyle = shade(0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.bezierCurveTo(cx - s * 28, cy + 28, cx + s * 30, cy + 24, outer.x, outer.y);
    ctx.stroke();

    // Eyelid crease
    ctx.strokeStyle = shade(isAnika ? 0.55 : 0.4);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - s * 44, cy - 22);
    ctx.bezierCurveTo(cx - s * 20, cy - 56, cx + s * 26, cy - 58, cx + s * 62, cy - 26);
    ctx.stroke();

    if (isAnika) {
      // Lashes
      ctx.strokeStyle = '#140a07';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const t = 0.5 + i * 0.1;
        const x = (1 - t) * (1 - t) * (1 - t) * inner.x + 3 * (1 - t) * (1 - t) * t * (cx - s * 30) + 3 * (1 - t) * t * t * (cx + s * 30) + t * t * t * outer.x;
        const y = (1 - t) * (1 - t) * (1 - t) * inner.y + 3 * (1 - t) * (1 - t) * t * (cy - 42) + 3 * (1 - t) * t * t * (cy - 44) + t * t * t * outer.y;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * (4 + i * 1.5), y - 11 - i);
        ctx.stroke();
      }
    }
  };
  drawEye(-1);
  drawEye(1);

  // Eyebrows: a tapered chain of circles for a soft, thick brow
  const drawBrow = (s: -1 | 1) => {
    const cx = 256 + s * 112;
    const p0 = { x: cx - s * 70, y: 180 };
    const c = { x: cx - s * 4, y: isAnika ? 128 : 142 };
    const p2 = { x: cx + s * 74, y: 172 };
    const thick = isAnika ? 11 : 13;
    ctx.fillStyle = isAnika ? mix(hair, '#000000', 0.2) : hair;
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x;
      const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y;
      const r = thick * (1 - 0.55 * t) + (i % 3 === 0 ? 0.8 : 0);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawBrow(-1);
  drawBrow(1);

  // Beauty mark on Anika's right cheek
  if (isAnika) {
    ctx.fillStyle = rgba('#2a130c', 0.85);
    ctx.beginPath();
    ctx.arc(62, 286, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export function buildHead(
  role: Role,
  appearance: CharacterAppearance,
  accentMat: THREE.Material,
): THREE.Group {
  const a = appearance;
  const head = new THREE.Group();
  const scale = headScaleFor(a.faceShape);
  const beardStyle = a.beardStyle || 'none';
  const headwear = a.headwear || 'none';
  const hasHijab = headwear === 'hijab';

  const skinMat = new THREE.MeshStandardMaterial({ color: a.skinTone, roughness: 0.72, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: a.hairColor,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  });
  const hijabMat = new THREE.MeshStandardMaterial({
    color: a.hijabColor || DEFAULT_HIJAB_COLOR,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const add = (m: THREE.Object3D, shadow = false) => {
    if (shadow && m instanceof THREE.Mesh) m.castShadow = true;
    head.add(m);
    return m;
  };
  const scaled = (m: THREE.Mesh) => {
    m.scale.set(...scale);
    return m;
  };

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.14, 12), skinMat);
  neck.position.y = -0.15;
  add(neck);

  // Smooth skull
  add(scaled(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 32), skinMat)), true);

  // Ears (hidden under a hijab)
  if (!hasHijab) {
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), skinMat);
    earL.scale.set(0.55, 1.05, 0.75);
    earL.position.set(-0.205 * scale[0], -0.01, -0.01);
    const earR = earL.clone();
    earR.position.x = 0.205 * scale[0];
    add(earL);
    add(earR);
  }

  // Nose bump so the profile is not flat
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 12), skinMat);
  nose.position.set(0, -0.04, R * scale[2] + 0.004);
  nose.scale.set(1.1, 1.15, 0.8);
  add(nose);

  // Painted face
  const tex = new THREE.CanvasTexture(paintFace(role, a));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.78,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const faceHalf = 0.62;
  const facePatch = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 48, 48, Math.PI / 2 - faceHalf, faceHalf * 2, Math.PI * 0.3, Math.PI * 0.5),
    faceMat,
  );
  scaled(facePatch);
  facePatch.renderOrder = 2;
  add(facePatch);

  // Beard volume at the sides and under the chin (the front is painted)
  if (beardStyle !== 'none') {
    const beardMat = hairMat.clone();
    if (beardStyle === 'stubble') {
      beardMat.color = new THREE.Color(a.skinTone).lerp(new THREE.Color(a.hairColor), 0.45);
    }
    const shell = (phiStart: number, phiLen: number, thetaStart: number, thetaLen: number) =>
      scaled(
        new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.035, 28, 14, phiStart, phiLen, thetaStart, thetaLen),
          beardMat,
        ),
      );
    const front = Math.PI / 2;
    const jawStart = Math.PI * 0.62;
    const jawLen = Math.PI * 0.28;
    const sideLen = 0.68;
    add(shell(front + faceHalf - 0.02, sideLen, jawStart, jawLen));
    add(shell(front - faceHalf + 0.02 - sideLen, sideLen, jawStart, jawLen));
    add(shell(Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.79, Math.PI * 0.1));
  }

  // Head accessories
  const frontZ = R * scale[2];
  if (a.accessory === 'bindi' && !hasHijab) {
    const bindi = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12),
      new THREE.MeshStandardMaterial({ color: '#be123c', emissive: '#881337', emissiveIntensity: 0.25, roughness: 0.3 }),
    );
    bindi.rotation.x = Math.PI / 2;
    bindi.position.set(0, 0.072, frontZ + 0.002);
    add(bindi);
  }
  if (a.accessory === 'monocle') {
    const monocle = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.008, 6, 16),
      new THREE.MeshStandardMaterial({ color: '#e2a84b', metalness: 0.9, roughness: 0.2 }),
    );
    monocle.position.set(0.064, 0.012, frontZ + 0.008);
    monocle.rotation.y = 0.2;
    add(monocle);
  }

  if (hasHijab) {
    buildHijab(head, scale, hijabMat);
  } else {
    buildHair(head, a, scale, hairMat);
  }

  if (a.accessory === 'fedora') {
    const hatMat = new THREE.MeshStandardMaterial({ color: a.primaryColor, roughness: 0.72, flatShading: true });
    const hat = new THREE.Group();
    hat.position.set(0, 0.195, -0.015);
    hat.rotation.x = -0.12;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.028, 12), hatMat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.215, 0.17, 10), hatMat);
    crown.position.y = 0.095;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.218, 0.218, 0.04, 10), accentMat);
    ribbon.position.y = 0.035;
    hat.add(brim, crown, ribbon);
    add(hat);
  }

  return head;
}

function buildHair(head: THREE.Group, a: CharacterAppearance, scale: HeadScale, hairMat: THREE.Material) {
  const hair = new THREE.Group();
  head.add(hair);

  // Crown and back of the head
  const crownCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.228, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat,
  );
  crownCap.scale.set(scale[0], scale[1], scale[2]);
  crownCap.rotation.x = a.hairStyle === 'fringe' ? -0.5 : -0.34;
  crownCap.position.set(0, 0.015, -0.012);
  hair.add(crownCap);

  const nape = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.18, 10), hairMat);
  nape.position.set(0, -0.06, -0.085);
  nape.rotation.x = 0.15;
  hair.add(nape);

  const style = a.hairStyle;
  if (style === 'fringe') {
    // Thick short hair with a fringe falling over the forehead
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 9), hairMat);
    top.scale.set(1.18 * scale[0], 0.62, 1.25);
    top.position.set(0, 0.155, 0.0);
    hair.add(top);

    const rand = seeded(21);
    const locks = 9;
    for (let i = 0; i < locks; i++) {
      const t = i / (locks - 1) - 0.5; // -0.5 .. 0.5
      const ang = t * 1.35;
      const len = 0.075 + rand() * 0.035 + (Math.abs(t) < 0.2 ? 0.01 : 0);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.062, len, 0.05), hairMat);
      const rr = 0.222 * scale[2];
      lock.position.set(Math.sin(ang) * rr * scale[0], 0.135 - len / 2 + 0.01 - Math.abs(t) * 0.02, Math.cos(ang) * rr);
      lock.rotation.set(0.35, ang, (rand() - 0.5) * 0.18);
      hair.add(lock);
    }
    // Short sides over the ears
    [-1, 1].forEach((s) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.16), hairMat);
      side.position.set(s * 0.2 * scale[0], 0.045, -0.025);
      hair.add(side);
    });
  } else if (style === 'quiff') {
    const topSweep = new THREE.Mesh(new THREE.SphereGeometry(0.145, 9, 7), hairMat);
    topSweep.scale.set(1.25, 0.72, 1.35);
    topSweep.position.set(0.01, 0.195, 0.045);
    topSweep.rotation.x = -0.22;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.14), hairMat);
    sideL.position.set(-0.185, 0.05, -0.02);
    const sideR = sideL.clone();
    sideR.position.x = 0.185;
    hair.add(topSweep, sideL, sideR);
  } else if (style === 'waves') {
    const bangL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 7), hairMat);
    bangL.scale.set(0.95, 1.15, 0.85);
    bangL.position.set(-0.12, 0.12, 0.085);
    const bangR = bangL.clone();
    bangR.position.x = 0.12;
    const drapeBack = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.44, 10), hairMat);
    drapeBack.position.set(0, -0.14, -0.105);
    drapeBack.rotation.x = 0.12;
    const lockL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.34, 7), hairMat);
    lockL.position.set(-0.19, -0.12, 0.02);
    lockL.rotation.z = 0.08;
    const lockR = lockL.clone();
    lockR.position.x = 0.19;
    lockR.rotation.z = -0.08;
    hair.add(bangL, bangR, drapeBack, lockL, lockR);
  } else if (style === 'bob') {
    const sideL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.28, 8), hairMat);
    sideL.position.set(-0.175, -0.04, -0.01);
    const sideR = sideL.clone();
    sideR.position.x = 0.175;
    const backBob = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.28, 10), hairMat);
    backBob.position.set(0, -0.05, -0.085);
    const sweepBang = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), hairMat);
    sweepBang.scale.set(1.4, 0.55, 0.8);
    sweepBang.position.set(0.03, 0.16, 0.11);
    sweepBang.rotation.z = -0.18;
    hair.add(sideL, sideR, backBob, sweepBang);
  } else if (style === 'sidepart') {
    const partSweep = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 7), hairMat);
    partSweep.scale.set(1.35, 0.52, 1.25);
    partSweep.position.set(0.03, 0.185, 0.025);
    partSweep.rotation.z = -0.16;
    hair.add(partSweep);
  } else if (style === 'braids') {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.05, 7, 12), hairMat);
    crown.rotation.x = Math.PI / 2 - 0.18;
    crown.position.set(0, 0.15, -0.01);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), hairMat);
    bun.position.set(0, -0.02, -0.24);
    const braidTail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.28, 7), hairMat);
    braidTail.position.set(0, -0.22, -0.22);
    braidTail.rotation.x = 0.15;
    hair.add(crown, bun, braidTail);
  } else if (style === 'curly') {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 1), hairMat);
      puff.position.set(Math.cos(ang) * 0.145, 0.165, Math.sin(ang) * 0.145 - 0.01);
      hair.add(puff);
    }
    const topPuff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 1), hairMat);
    topPuff.position.set(0, 0.22, 0);
    hair.add(topPuff);
  }
}

function buildHijab(head: THREE.Group, scale: HeadScale, mat: THREE.Material) {
  const hj = new THREE.Group();
  head.add(hj);
  const r = R * 1.065;
  // Oval face opening, in sphere angles: phi around the head (0 = front), theta from the crown
  const cx = 0;
  const cT = Math.PI * 0.585;
  const ax = 0.66;
  const ay = Math.PI * 0.225;
  const inside = (phi: number, theta: number) => {
    const dx = (phi - cx) / ax;
    const dy = (theta - cT) / ay;
    return dx * dx + dy * dy < 1;
  };
  const pos = (theta: number, phi: number, k = 1) =>
    new THREE.Vector3(
      r * k * Math.sin(theta) * Math.sin(phi) * scale[0],
      r * k * Math.cos(theta) * scale[1],
      r * k * Math.sin(theta) * Math.cos(phi) * scale[2],
    );

  // Sphere with the face opening cut out
  const W = 72;
  const H = 54;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= H; y++) {
    const theta = (y / H) * Math.PI * 0.8;
    for (let x = 0; x <= W; x++) {
      const phi = (x / W) * Math.PI * 2 - Math.PI;
      const v = pos(theta, phi);
      verts.push(v.x, v.y, v.z);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
      const theta = ((y + 0.5) / H) * Math.PI * 0.8;
      if (inside(phi, theta)) continue;
      const a = y * (W + 1) + x;
      const b = a + 1;
      const c = a + W + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  hj.add(new THREE.Mesh(geo, mat));

  // Soft rolled edge along the opening
  const pts: THREE.Vector3[] = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    pts.push(pos(cT + Math.cos(t) * ay * 1.0, cx + Math.sin(t) * ax * 1.0, 1.012));
  }
  hj.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.014, 8, true), mat));
}
