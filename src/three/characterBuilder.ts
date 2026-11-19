import * as THREE from 'three';
import type {
  CharacterAppearance,
  CluePropType,
  FurnitureDef,
  Role,
  SuspectDef,
} from '../types/game.ts';
import { buildHead } from './faceBuilder.ts';
import { getContactShadowTexture } from './proceduralTextures.ts';

export interface CharacterRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torsoGroup: THREE.Group;
  lanternLight?: THREE.PointLight;
}

/**
 * Builds a stylised low-poly composite character (10+ distinct parts)
 * grounded at Y = 0 (bottom-center pivot).
 */
export function buildCharacterRig(
  role: Role,
  appearance: CharacterAppearance,
  withLanternLight = false,
): CharacterRig {
  const root = new THREE.Group();
  const isAnika = role === 'anika';

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.72,
    metalness: 0.02,
    flatShading: true,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  });
  const primaryMat = new THREE.MeshStandardMaterial({
    color: appearance.primaryColor,
    roughness: 0.68,
    metalness: 0.08,
    flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: appearance.accentColor,
    roughness: 0.42,
    metalness: 0.35,
    flatShading: true,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#1b1817',
    roughness: 0.55,
    metalness: 0.15,
    flatShading: true,
  });
  const darkPantsMat = new THREE.MeshStandardMaterial({
    color: '#202430',
    roughness: 0.78,
    metalness: 0.04,
    flatShading: true,
  });

  // Contact shadow grounding
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // Legs (pivot at hip Y = 0.68)
  const buildLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.68, 0);

    const legGeo =
      appearance.bottomStyle === 'riding'
        ? new THREE.CylinderGeometry(0.11, 0.085, 0.48, 6)
        : new THREE.BoxGeometry(0.18, 0.5, 0.19);
    const legMesh = new THREE.Mesh(legGeo, darkPantsMat);
    legMesh.position.y = -0.25;
    legMesh.castShadow = true;
    legPivot.add(legMesh);

    const bootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.27), bootMat);
    bootMesh.position.set(0, -0.58, 0.03);
    bootMesh.castShadow = true;
    legPivot.add(bootMesh);

    return legPivot;
  };

  const legSpacing = isAnika ? 0.13 : 0.15;
  const leftLeg = buildLeg(-legSpacing);
  const rightLeg = buildLeg(legSpacing);
  root.add(leftLeg, rightLeg);

  // Torso group (bobbing during walk)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.68, 0);
  root.add(torsoGroup);

  // Optional pleated skirt over hips
  if (appearance.bottomStyle === 'skirt') {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.36, 0.4, 8),
      primaryMat,
    );
    skirt.position.y = -0.14;
    skirt.castShadow = true;
    torsoGroup.add(skirt);
  }

  // Torso silhouette based on topStyle
  const torsoWidth = isAnika ? 0.44 : 0.52;
  const torsoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoWidth * 0.52, torsoWidth * 0.44, 0.58, 7),
    primaryMat,
  );
  torsoMesh.position.y = 0.3;
  torsoMesh.castShadow = true;
  torsoGroup.add(torsoMesh);

  if (appearance.topStyle === 'trench') {
    const coatTail = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth * 0.47, torsoWidth * 0.6, 0.38, 7),
      primaryMat,
    );
    coatTail.position.y = -0.06;
    coatTail.castShadow = true;
    torsoGroup.add(coatTail);

    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.08), accentMat);
    lapel.position.set(0, 0.41, 0.21);
    torsoGroup.add(lapel);
  } else if (appearance.topStyle === 'waistcoat') {
    const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 0.06), accentMat);
    vestFront.position.set(0, 0.3, 0.21);
    torsoGroup.add(vestFront);
  } else if (appearance.topStyle === 'blazer') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 5, 10), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.57, 0.02);
    torsoGroup.add(collar);
  } else {
    // Sweater ribbed band
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.1, 7), accentMat);
    hem.position.y = 0.06;
    torsoGroup.add(hem);
  }

  // Belt / sash accent
  const belt = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 0.92, 0.07, 0.36), bootMat);
  belt.position.y = 0.06;
  torsoGroup.add(belt);

  // Accessory: Scarf or Satchel
  if (appearance.accessory === 'scarf') {
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 6, 10), accentMat);
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.set(0, 0.58, 0);
    torsoGroup.add(scarfRing);

    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.05), accentMat);
    scarfTail.position.set(0.12, 0.42, 0.21);
    scarfTail.rotation.z = -0.15;
    torsoGroup.add(scarfTail);
  } else if (appearance.accessory === 'satchel') {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.38), bootMat);
    strap.position.set(0, 0.32, 0);
    strap.rotation.z = 0.55;
    torsoGroup.add(strap);

    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.24), accentMat);
    bag.position.set(-0.28, 0.05, 0.02);
    torsoGroup.add(bag);
  }

  // Head: face, hair, beard, hijab and head accessories
  const headGroup = buildHead(role, appearance, accentMat);
  headGroup.position.set(0, 0.78, 0);
  torsoGroup.add(headGroup);

  // Arms (pivot at shoulder)
  const buildArm = (xOffset: number, holdsLantern: boolean) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.52, 0);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.15), primaryMat);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), skinMat);
    hand.position.y = -0.45;
    armPivot.add(hand);

    if (holdsLantern) {
      const brassMat = new THREE.MeshStandardMaterial({
        color: '#d49b42',
        metalness: 0.85,
        roughness: 0.25,
      });
      const lanternBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.06, 0.16, 6),
        new THREE.MeshStandardMaterial({
          color: '#ffd68a',
          emissive: '#ffaa33',
          emissiveIntensity: 1.4,
          roughness: 0.2,
        }),
      );
      lanternBody.position.set(0, -0.58, 0.1);
      const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 6), brassMat);
      lanternCap.position.set(0, -0.48, 0.1);
      armPivot.add(lanternBody, lanternCap);

      if (withLanternLight) {
        const light = new THREE.PointLight('#ffba59', 2.4, 9.5, 1.8);
        light.position.set(0, -0.55, 0.16);
        armPivot.add(light);
      }
    }

    return armPivot;
  };

  const armX = isAnika ? 0.3 : 0.34;
  const leftArm = buildArm(-armX, false);
  const rightArm = buildArm(armX, true);
  // Hold lantern slightly forward
  rightArm.rotation.x = -0.42;
  torsoGroup.add(leftArm, rightArm);

  return {
    root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    torsoGroup,
  };
}

/**
 * Builds a composite ghostly suspect figure (5-7 parts) with translucent spectral glow.
 */
export function buildGhostSuspectMesh(suspect: SuspectDef): THREE.Group {
  const group = new THREE.Group();
  const tint = new THREE.Color(suspect.ghostTint);

  const ghostMat = new THREE.MeshStandardMaterial({
    color: tint,
    emissive: tint,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.78,
    roughness: 0.35,
    metalness: 0.1,
    flatShading: true,
  });

  // Ground spectral ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.62, 18),
    new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  // Floating body wrapper
  const body = new THREE.Group();
  body.name = 'ghostBody';
  group.add(body);

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.35, 8), ghostMat);
  robe.position.y = 0.85;
  body.add(robe);

  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.38, 7), ghostMat);
  shoulders.position.y = 1.25;
  body.add(shoulders);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), ghostMat);
  head.position.y = 1.66;
  body.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), eyeMat);
  eyeL.position.set(-0.07, 1.68, 0.18);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  body.add(eyeL, eyeR);

  if (suspect.hatStyle === 'tophat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8), ghostMat);
    brim.position.y = 1.85;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.26, 8), ghostMat);
    top.position.y = 1.98;
    body.add(brim, top);
  } else if (suspect.hatStyle === 'veil') {
    const veil = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 6), ghostMat);
    veil.position.set(0, 1.72, -0.05);
    body.add(veil);
  } else if (suspect.hatStyle === 'hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), ghostMat);
    hood.position.set(0, 1.69, -0.03);
    body.add(hood);
  } else if (suspect.hatStyle === 'spectacles') {
    const specMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const specL = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 5, 10), specMat);
    specL.position.set(-0.07, 1.68, 0.2);
    const specR = specL.clone();
    specR.position.x = 0.07;
    body.add(specL, specR);
  }

  return group;
}

/**
 * Builds composite 3-5 part Clue Prop meshes on pedestals or floor marks.
 */
export function buildCluePropMesh(
  propType: CluePropType,
  visibleToMe: boolean,
  alreadyDiscovered: boolean,
): THREE.Group {
  const group = new THREE.Group();

  const auraColor = !visibleToMe ? '#64748b' : alreadyDiscovered ? '#4ade80' : '#f5b942';
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 16),
    new THREE.MeshBasicMaterial({
      color: auraColor,
      transparent: true,
      opacity: !visibleToMe ? 0.25 : 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.025;
  auraRing.name = 'clueRing';
  group.add(auraRing);

  const propGroup = new THREE.Group();
  propGroup.name = 'clueFloat';
  group.add(propGroup);

  if (!visibleToMe) {
    // Faint partner-only spectral wisp
    const wisp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        emissive: '#475569',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.45,
        flatShading: true,
      }),
    );
    wisp.position.y = 0.48;
    propGroup.add(wisp);
    return group;
  }

  const goldMat = new THREE.MeshStandardMaterial({
    color: '#e2a84b',
    metalness: 0.8,
    roughness: 0.25,
    emissive: alreadyDiscovered ? '#15803d' : '#a16207',
    emissiveIntensity: 0.35,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: '#efe5ce',
    roughness: 0.85,
    emissive: '#543b10',
    emissiveIntensity: 0.22,
  });

  if (propType === 'dagger') {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.34, 4),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.92, roughness: 0.16 }),
    );
    blade.rotation.z = Math.PI / 3;
    blade.position.y = 0.45;
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.18), goldMat);
    hilt.rotation.z = Math.PI / 3;
    hilt.position.set(0.14, 0.36, 0);
    propGroup.add(blade, hilt);
  } else if (propType === 'vial') {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.22, 7),
      new THREE.MeshStandardMaterial({
        color: '#86efac',
        emissive: '#16a34a',
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.82,
        roughness: 0.15,
      }),
    );
    bottle.position.y = 0.44;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 6), goldMat);
    cork.position.y = 0.58;
    propGroup.add(bottle, cork);
  } else if (propType === 'ledger' || propType === 'letter' || propType === 'blueprint') {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.05, 0.24),
      propType === 'ledger'
        ? new THREE.MeshStandardMaterial({ color: '#5c1f2b', roughness: 0.75 })
        : paperMat,
    );
    cover.position.y = 0.42;
    cover.rotation.x = 0.25;
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 }),
    );
    seal.position.set(0.06, 0.45, 0.04);
    seal.rotation.x = 0.25;
    propGroup.add(cover, seal);
  } else if (propType === 'key' || propType === 'locket') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), goldMat);
    ring.position.y = 0.48;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), goldMat);
    stem.position.y = 0.34;
    propGroup.add(ring, stem);
  } else {
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), goldMat);
    orb.position.y = 0.46;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.08, 8), paperMat);
    base.position.y = 0.28;
    propGroup.add(orb, base);
  }

  return group;
}

/**
 * Builds composite multi-part Victorian furniture pieces grounded at Y = 0.
 */
export function buildFurnitureMesh(item: FurnitureDef): THREE.Group {
  const group = new THREE.Group();
  group.position.set(item.position[0], item.position[1], item.position[2]);
  if (item.rotationY) group.rotation.y = item.rotationY;

  const [w, h, d] = item.size;
  const mainMat = new THREE.MeshStandardMaterial({
    color: item.color || '#4a2f1f',
    roughness: 0.65,
    metalness: 0.08,
    flatShading: true,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#c99744',
    roughness: 0.28,
    metalness: 0.85,
  });

  if (item.kind === 'table' || item.kind === 'desk') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mainMat);
    top.position.y = h - 0.05;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.11, h - 0.1, 0.11);
    const lx = w / 2 - 0.12;
    const lz = d / 2 - 0.12;
    [
      [-lx, -lz],
      [lx, -lz],
      [-lx, lz],
      [lx, lz],
    ].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, mainMat);
      leg.position.set(x, (h - 0.1) / 2, z);
      leg.castShadow = true;
      group.add(leg);
    });

    // Small candlestick accent on tables
    const candleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.16, 6), brassMat);
    candleBase.position.set(0, h + 0.08, 0);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.09, 5),
      new THREE.MeshBasicMaterial({ color: '#ffcf6b' }),
    );
    flame.position.set(0, h + 0.2, 0);
    group.add(candleBase, flame);
  } else if (item.kind === 'bookshelf') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mainMat);
    frame.position.y = h / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const bookColors = ['#7c2d3b', '#274c45', '#2a3d66', '#6b4c24'];
    for (let s = 0; s < 4; s++) {
      const bookRow = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.04, 0.26, d - 0.25),
        new THREE.MeshStandardMaterial({
          color: bookColors[s % bookColors.length],
          roughness: 0.78,
        }),
      );
      bookRow.position.y = 0.45 + s * 0.58;
      group.add(bookRow);
    }
  } else if (item.kind === 'clock') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.75, d), mainMat);
    body.position.y = (h * 0.75) / 2;
    body.castShadow = true;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.52, h * 0.25, 6), mainMat);
    crown.position.y = h * 0.87;
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.34, w * 0.34, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.4 }),
    );
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0, h * 0.82, d / 2 + 0.01);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w * 0.35, 0.03, 6, 12), brassMat);
    rim.position.set(0, h * 0.82, d / 2 + 0.03);
    group.add(body, crown, dial, rim);
  } else if (item.kind === 'piano') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), mainMat);
    body.position.y = h * 0.65;
    body.castShadow = true;
    const keys = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.08, 0.32),
      new THREE.MeshStandardMaterial({ color: '#f2ece1', roughness: 0.3 }),
    );
    keys.position.set(0, h * 0.58, d / 2 + 0.1);
    const legGeo = new THREE.CylinderGeometry(0.08, 0.06, h * 0.5, 6);
    [
      [-w * 0.38, -d * 0.35],
      [w * 0.38, -d * 0.35],
      [-w * 0.38, d * 0.35],
      [w * 0.38, d * 0.35],
    ].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, mainMat);
      leg.position.set(x, h * 0.25, z);
      group.add(leg);
    });
    group.add(body, keys);
  } else if (item.kind === 'sofa') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.48, d), mainMat);
    seat.position.y = h * 0.28;
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.65, 0.25), mainMat);
    back.position.set(0, h * 0.6, d / 2 - 0.12);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, h * 0.5, d), mainMat);
    armL.position.set(-w / 2 + 0.12, h * 0.45, 0);
    const armR = armL.clone();
    armR.position.x = w / 2 - 0.12;
    group.add(seat, back, armL, armR);
  } else if (item.kind === 'fountain') {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.55, 0.55, 10), mainMat);
    basin.position.y = 0.275;
    basin.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.44, w * 0.44, 0.06, 10),
      new THREE.MeshStandardMaterial({
        color: '#2dd4bf',
        emissive: '#0f766e',
        emissiveIntensity: 0.35,
        roughness: 0.15,
        metalness: 0.3,
      }),
    );
    water.position.y = 0.54;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 8), mainMat);
    spire.position.y = h * 0.55;
    group.add(basin, water, spire);
  } else if (item.kind === 'chandelier') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.45, 0.05, 6, 12), brassMat);
    ring.rotation.x = Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), brassMat);
    stem.position.y = 0.45;
    group.add(ring, stem);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffd984' }),
      );
      bulb.position.set(Math.cos(ang) * w * 0.45, 0.1, Math.sin(ang) * w * 0.45);
      group.add(bulb);
    }
  } else if (item.kind === 'barrel') {
    const keg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, h, 10), mainMat);
    keg.position.y = h / 2;
    keg.castShadow = true;
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.43, 0.025, 5, 10),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.35 }),
    );
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = h * 0.72;
    const hoop2 = hoop.clone();
    hoop2.position.y = h * 0.28;
    group.add(keg, hoop, hoop2);
  } else if (item.kind === 'telescope') {
    const tripod = new THREE.Mesh(new THREE.ConeGeometry(w * 0.4, h * 0.65, 3), mainMat);
    tripod.position.y = h * 0.325;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.1, 8), brassMat);
    tube.position.set(0, h * 0.78, 0);
    tube.rotation.x = Math.PI / 3;
    group.add(tripod, tube);
  } else if (item.kind === 'armor') {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), mainMat);
    plinth.position.y = 0.175;
    const armorMat = new THREE.MeshStandardMaterial({
      color: '#8e99a8',
      metalness: 0.85,
      roughness: 0.28,
      flatShading: true,
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.9, 6), armorMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), armorMat);
    helm.position.y = 1.6;
    group.add(plinth, torso, helm);
  } else {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mainMat);
    block.position.y = h / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06), brassMat);
    trim.position.y = h;
    group.add(block, trim);
  }

  return group;
}
