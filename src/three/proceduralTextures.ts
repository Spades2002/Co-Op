import * as THREE from 'three';

const textureCache = new Map<string, THREE.Texture>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function getWoodFloorTexture(baseHex: string, maxAnisotropy = 4): THREE.Texture {
  const key = `wood_${baseHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const plankH = 32;
  for (let y = 0; y < 256; y += plankH) {
    const shade = ((y / plankH) % 2 === 0 ? 8 : -8);
    ctx.fillStyle = shade > 0 ? 'rgba(255,220,180,0.06)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, y, 256, plankH);

    // Grain lines
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    const offset = ((y / plankH) % 2) * 64;
    ctx.beginPath();
    ctx.moveTo(offset + 128, y);
    ctx.lineTo(offset + 128, y + plankH);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,235,205,0.04)';
    for (let g = 4; g < plankH; g += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y + g);
      ctx.lineTo(256, y + g + (g % 2 === 0 ? 1 : -1));
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getMarbleFloorTexture(baseHex: string, maxAnisotropy = 4): THREE.Texture {
  const key = `marble_${baseHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const size = 64;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      const dark = ((x + y) / size) % 2 === 0;
      ctx.fillStyle = dark ? 'rgba(12,14,22,0.55)' : 'rgba(220,224,232,0.22)';
      ctx.fillRect(x, y, size, size);

      // Subtle marble vein
      ctx.strokeStyle = dark ? 'rgba(180,190,210,0.08)' : 'rgba(40,46,60,0.12)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 12);
      ctx.quadraticCurveTo(x + 32, y + 28, x + 58, y + 48);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getStoneFloorTexture(baseHex: string, maxAnisotropy = 4): THREE.Texture {
  const key = `stone_${baseHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const rows = 4;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 42;
    for (let x = -42; x < 256; x += 85) {
      ctx.fillStyle = (r + x) % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + offset + 2, r * rowH + 2, 81, rowH - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + offset + 1, r * rowH + 1, 83, rowH - 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getWallpaperTexture(wallHex: string, maxAnisotropy = 4): THREE.Texture {
  const key = `wall_${wallHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 256);

  // Victorian vertical stripe & diamond damask motif
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 14, 256);
  }
  ctx.fillStyle = 'rgba(226,168,75,0.08)';
  for (let y = 16; y < 256; y += 48) {
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Lower wood wainscot band
  ctx.fillStyle = 'rgba(24,15,12,0.58)';
  ctx.fillRect(0, 185, 256, 71);
  ctx.fillStyle = 'rgba(226,168,75,0.16)';
  ctx.fillRect(0, 183, 256, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getRugTexture(rugHex: string, maxAnisotropy = 4): THREE.Texture {
  const key = `rug_${rugHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = rugHex;
  ctx.fillRect(0, 0, 256, 256);

  // Ornamental gold border
  ctx.strokeStyle = 'rgba(226,168,75,0.55)';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 232, 232);
  ctx.strokeStyle = 'rgba(255,235,190,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 208);

  // Center medallion
  ctx.fillStyle = 'rgba(226,168,75,0.25)';
  ctx.beginPath();
  ctx.moveTo(128, 64);
  ctx.lineTo(182, 128);
  ctx.lineTo(128, 192);
  ctx.lineTo(74, 128);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function getContactShadowTexture(): THREE.Texture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}
