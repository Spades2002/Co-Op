import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  findRoomAtPosition,
  MANSION_ROOMS,
  resolvePlayerMovement,
} from '../data/mansionLayout.ts';
import type {
  CaseData,
  CharacterAppearance,
  ClueDef,
  GraphicsQuality,
  PingBeacon,
  PlayerSettings,
  PlayerSyncState,
  PuzzleDef,
  Role,
  SuspectDef,
} from '../types/game.ts';
import {
  buildCharacterRig,
  buildCluePropMesh,
  buildFurnitureMesh,
  buildGhostSuspectMesh,
  type CharacterRig,
} from './characterBuilder.ts';
import {
  getMarbleFloorTexture,
  getRugTexture,
  getStoneFloorTexture,
  getWallpaperTexture,
  getWoodFloorTexture,
} from './proceduralTextures.ts';

export type InteractTarget =
  | { kind: 'clue'; clue: ClueDef; visibleToMe: boolean; lockedReason?: string }
  | { kind: 'suspect'; suspect: SuspectDef }
  | { kind: 'puzzle'; puzzle: PuzzleDef; solved: boolean };

export interface MansionEngineCallbacks {
  onLocalMove: (pos: [number, number, number], rotY: number, moving: boolean, roomId: string) => void;
  onNearTargetChange: (target: InteractTarget | null) => void;
  onInteract: (target: InteractTarget) => void;
  onFootstep: () => void;
  onContextLostChange?: (lost: boolean) => void;
}

export interface MansionEngineInput {
  joyX: number;
  joyY: number;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class MansionSceneEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  private myRole: Role;
  private caseData: CaseData;
  private settings: PlayerSettings;
  private callbacks: MansionEngineCallbacks;

  private worldGroup = new THREE.Group();
  private clueGroup = new THREE.Group();
  private suspectGroup = new THREE.Group();
  private puzzleGroup = new THREE.Group();
  private pingGroup = new THREE.Group();
  private dustPoints: THREE.Points | null = null;

  private myRig: CharacterRig | null = null;
  private partnerRig: CharacterRig | null = null;
  private partnerAppearanceKey = '';
  private partnerTargetPos = new THREE.Vector3(1.4, 0, 12.2);
  private partnerTargetRot = Math.PI;
  private partnerMoving = false;
  private partnerConnected = false;

  private myPos = new THREE.Vector3(-1.4, 0, 12.2);
  private myRotY = Math.PI;
  private myWalkPhase = 0;
  private partnerWalkPhase = 0;
  private footstepTimer = 0;

  private cameraYaw = 0;
  private cameraPitch = 0.44;
  private cameraDist = 5.6;

  private keys: Record<string, boolean> = {};
  public joystickInput: MansionEngineInput = { joyX: 0, joyY: 0 };

  private dragging = false;
  private dragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistMoved = 0;

  private clueMeshes = new Map<string, THREE.Group>();
  private suspectMeshes = new Map<string, THREE.Group>();
  private puzzleMeshes = new Map<string, THREE.Group>();
  private raycaster = new THREE.Raycaster();
  private clickables: THREE.Object3D[] = [];

  private discoveredClueIds = new Set<string>();
  private solvedPuzzleIds = new Set<string>();
  private soloPreviewMode = false;

  private currentNearKey = '';
  private currentNearTarget: InteractTarget | null = null;
  private lastNetEmit = 0;

  // Screen-projected label elements updated directly without React re-renders
  private partnerLabelEl: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    params: {
      myRole: Role;
      myAppearance: CharacterAppearance;
      initialPos: [number, number, number];
      caseData: CaseData;
      settings: PlayerSettings;
      callbacks: MansionEngineCallbacks;
      partnerLabelEl?: HTMLElement | null;
    },
  ) {
    this.container = container;
    this.myRole = params.myRole;
    this.caseData = params.caseData;
    this.settings = params.settings;
    this.callbacks = params.callbacks;
    this.partnerLabelEl = params.partnerLabelEl || null;
    this.myPos.set(params.initialPos[0], 0, params.initialPos[2]);

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && params.settings.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.applyGraphicsQuality(params.settings.graphicsQuality);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c101b');
    this.scene.fog = new THREE.FogExp2('#0c101b', 0.032);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(54, w / h, 0.1, 110);

    // Warm/Cool atmospheric haunted manor lighting rig
    const hemi = new THREE.HemisphereLight('#7a95c9', '#241816', 0.85);
    this.scene.add(hemi);

    const moonKey = new THREE.DirectionalLight('#b9d0ff', 1.15);
    moonKey.position.set(16, 26, 18);
    if (!this.isSoftwareGl && params.settings.graphicsQuality !== 'low') {
      moonKey.castShadow = true;
      moonKey.shadow.mapSize.set(
        params.settings.graphicsQuality === 'high' ? 2048 : 1024,
        params.settings.graphicsQuality === 'high' ? 2048 : 1024,
      );
      moonKey.shadow.camera.left = -28;
      moonKey.shadow.camera.right = 28;
      moonKey.shadow.camera.top = 28;
      moonKey.shadow.camera.bottom = -28;
      moonKey.shadow.camera.near = 2;
      moonKey.shadow.camera.far = 70;
      moonKey.shadow.bias = -0.0005;
      moonKey.shadow.normalBias = 0.02;
    }
    this.scene.add(moonKey);

    const warmRim = new THREE.DirectionalLight('#ffba66', 0.45);
    warmRim.position.set(-18, 12, -20);
    this.scene.add(warmRim);

    this.scene.add(this.worldGroup);
    this.scene.add(this.clueGroup);
    this.scene.add(this.suspectGroup);
    this.scene.add(this.puzzleGroup);
    this.scene.add(this.pingGroup);

    this.buildMansionArchitecture();
    this.buildAmbientDust(params.settings.graphicsQuality);
    this.buildCaseEntities();
    this.setMyAppearance(params.myAppearance);

    // Position camera immediately so first frame looks right
    this.updateCamera(1);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.tick();
  }

  public applyGraphicsQuality(quality: GraphicsQuality) {
    const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  public updateSettings(next: PlayerSettings) {
    const qualityChanged = next.graphicsQuality !== this.settings.graphicsQuality;
    this.settings = next;
    if (qualityChanged) {
      this.applyGraphicsQuality(next.graphicsQuality);
    }
  }

  public setPartnerLabelElement(el: HTMLElement | null) {
    this.partnerLabelEl = el;
  }

  public setMyRoleAndAppearance(role: Role, appearance: CharacterAppearance) {
    this.myRole = role;
    this.setMyAppearance(appearance);
    this.rebuildClueMeshes();
  }

  public setMyAppearance(appearance: CharacterAppearance) {
    if (this.myRig) {
      this.scene.remove(this.myRig.root);
    }
    this.myRig = buildCharacterRig(this.myRole, appearance, true);
    this.myRig.root.position.copy(this.myPos);
    this.myRig.root.rotation.y = this.myRotY;
    this.scene.add(this.myRig.root);
  }

  public syncRoomEntities(params: {
    discoveredClueIds: string[];
    solvedPuzzleIds: string[];
    partner?: PlayerSyncState;
    pings: PingBeacon[];
    soloPreviewMode: boolean;
  }) {
    const prevCluesSize = this.discoveredClueIds.size;
    const prevPuzzlesSize = this.solvedPuzzleIds.size;
    const prevSolo = this.soloPreviewMode;

    this.discoveredClueIds = new Set(params.discoveredClueIds);
    this.solvedPuzzleIds = new Set(params.solvedPuzzleIds);
    this.soloPreviewMode = params.soloPreviewMode;

    if (
      prevCluesSize !== this.discoveredClueIds.size ||
      prevPuzzlesSize !== this.solvedPuzzleIds.size ||
      prevSolo !== this.soloPreviewMode
    ) {
      this.rebuildClueMeshes();
      this.rebuildPuzzleMeshes();
    }

    if (params.partner && params.partner.connected) {
      this.partnerConnected = true;
      const appKey = JSON.stringify(params.partner.appearance);
      if (!this.partnerRig || appKey !== this.partnerAppearanceKey) {
        this.partnerAppearanceKey = appKey;
        if (this.partnerRig) this.scene.remove(this.partnerRig.root);
        this.partnerRig = buildCharacterRig(params.partner.role, params.partner.appearance, false);
        this.partnerRig.root.position.set(...params.partner.position);
        this.partnerRig.root.rotation.y = params.partner.rotationY;
        this.scene.add(this.partnerRig.root);
      }
      this.partnerTargetPos.set(...params.partner.position);
      this.partnerTargetRot = params.partner.rotationY;
      this.partnerMoving = params.partner.moving;
    } else {
      this.partnerConnected = false;
      if (this.partnerRig) {
        this.scene.remove(this.partnerRig.root);
        this.partnerRig = null;
        this.partnerAppearanceKey = '';
      }
    }

    this.rebuildPings(params.pings);
  }

  public updatePartnerPositionDirect(
    position: [number, number, number],
    rotationY: number,
    moving: boolean,
  ) {
    this.partnerTargetPos.set(position[0], 0, position[2]);
    this.partnerTargetRot = rotationY;
    this.partnerMoving = moving;
  }

  public loadCase(caseData: CaseData, resetPlayer = true) {
    this.caseData = caseData;
    if (resetPlayer) {
      this.myPos.set(this.myRole === 'staines' ? -1.4 : 1.4, 0, 12.2);
      this.myRotY = Math.PI;
      if (this.myRig) {
        this.myRig.root.position.copy(this.myPos);
        this.myRig.root.rotation.y = this.myRotY;
      }
    }
    this.buildMansionArchitecture();
    this.buildCaseEntities();
  }

  public triggerInteractFromUI() {
    if (this.currentNearTarget) {
      this.callbacks.onInteract(this.currentNearTarget);
    }
  }

  private isClueVisibleToMe(clue: ClueDef): boolean {
    if (this.soloPreviewMode) return true;
    return clue.visibility === 'both' || clue.visibility === this.myRole;
  }

  private getClueLockReason(clue: ClueDef): string | undefined {
    if (clue.requiresPuzzleId && !this.solvedPuzzleIds.has(clue.requiresPuzzleId)) {
      const puz = this.caseData.puzzles.find((p) => p.id === clue.requiresPuzzleId);
      return `Locked behind ${puz?.title || 'a mansion mechanism'}.`;
    }
    if (clue.requiresClueId && !this.discoveredClueIds.has(clue.requiresClueId)) {
      const req = this.caseData.clues.find((c) => c.id === clue.requiresClueId);
      return `Requires deciphering "${req?.title || 'a prior clue'}" first.`;
    }
    return undefined;
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }
  }

  private buildMansionArchitecture() {
    this.clearGroup(this.worldGroup);
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const activeIds = new Set(this.caseData.activeRoomIds);
    const wallHeight = 3.8;
    const wallThickness = 0.34;

    for (const room of MANSION_ROOMS) {
      if (!activeIds.has(room.id)) continue;
      const { minX, maxX, minZ, maxZ } = room.bounds;
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      // Floor
      const floorTex =
        room.floorStyle === 'marble'
          ? getMarbleFloorTexture(room.floorColor, maxAniso).clone()
          : room.floorStyle === 'stone'
            ? getStoneFloorTexture(room.floorColor, maxAniso).clone()
            : getWoodFloorTexture(room.floorColor, maxAniso).clone();
      floorTex.needsUpdate = true;
      floorTex.repeat.set(Math.max(1, width / 4), Math.max(1, depth / 4));

      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: room.floorStyle === 'marble' ? 0.32 : 0.78,
        metalness: room.floorStyle === 'marble' ? 0.12 : 0.04,
      });
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(cx, 0, cz);
      floorMesh.receiveShadow = true;
      this.worldGroup.add(floorMesh);

      // Decorative rug (offset Y >= 0.025 to prevent Z-fighting)
      if (room.rugColor) {
        const rugMat = new THREE.MeshStandardMaterial({
          map: getRugTexture(room.rugColor, maxAniso),
          roughness: 0.92,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const rug = new THREE.Mesh(
          new THREE.PlaneGeometry(width * 0.52, depth * 0.52),
          rugMat,
        );
        rug.rotation.x = -Math.PI / 2;
        rug.position.set(cx, 0.025, cz);
        rug.receiveShadow = true;
        this.worldGroup.add(rug);
      }

      // Room soft warm overhead lantern light
      if (room.id === 'foyer' || room.id === 'hallway' || room.id === 'conservatory') {
        const pt = new THREE.PointLight(
          room.id === 'conservatory' ? '#7fd4c8' : '#ffb861',
          1.35,
          16,
          1.6,
        );
        pt.position.set(cx, 3.2, cz);
        this.worldGroup.add(pt);
      }

      // Build outer/shared walls with doorway cutouts
      const wallTex = getWallpaperTexture(room.wallColor, maxAniso);
      const wallMat = new THREE.MeshStandardMaterial({
        map: wallTex,
        roughness: 0.85,
        metalness: 0.02,
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: '#2a1b14',
        roughness: 0.7,
      });

      const addSegmentedWall = (
        fixedCoord: number,
        start: number,
        end: number,
        axis: 'x' | 'z',
      ) => {
        const doorsOnWall = room.doors.filter((d) => {
          if (d.axis !== axis) return false;
          const dFixed = axis === 'x' ? d.position[2] : d.position[0];
          return Math.abs(dFixed - fixedCoord) < 0.25;
        });

        const spans: [number, number][] = [];
        let cursor = start;
        const sorted = [...doorsOnWall].sort((a, b) => {
          const va = axis === 'x' ? a.position[0] : a.position[2];
          const vb = axis === 'x' ? b.position[0] : b.position[2];
          return va - vb;
        });

        for (const d of sorted) {
          const center = axis === 'x' ? d.position[0] : d.position[2];
          const isPassable = activeIds.has(d.toRoomId);
          if (!isPassable) continue;
          const dMin = center - d.width / 2;
          const dMax = center + d.width / 2;
          if (dMin > cursor + 0.05) {
            spans.push([cursor, dMin]);
          }
          // Door lintel above opening
          const lintelH = 0.85;
          const lintel = new THREE.Mesh(
            axis === 'x'
              ? new THREE.BoxGeometry(d.width, lintelH, wallThickness)
              : new THREE.BoxGeometry(wallThickness, lintelH, d.width),
            trimMat,
          );
          lintel.position.set(
            axis === 'x' ? center : fixedCoord,
            wallHeight - lintelH / 2,
            axis === 'x' ? fixedCoord : center,
          );
          this.worldGroup.add(lintel);

          cursor = Math.max(cursor, dMax);
        }
        if (end > cursor + 0.05) {
          spans.push([cursor, end]);
        }

        for (const [s0, s1] of spans) {
          const len = s1 - s0;
          const mid = (s0 + s1) / 2;
          const seg = new THREE.Mesh(
            axis === 'x'
              ? new THREE.BoxGeometry(len, wallHeight, wallThickness)
              : new THREE.BoxGeometry(wallThickness, wallHeight, len),
            wallMat,
          );
          seg.position.set(
            axis === 'x' ? mid : fixedCoord,
            wallHeight / 2,
            axis === 'x' ? fixedCoord : mid,
          );
          seg.castShadow = true;
          seg.receiveShadow = true;
          this.worldGroup.add(seg);
        }
      };

      // North & South walls (along X), East & West walls (along Z)
      addSegmentedWall(minZ, minX, maxX, 'x');
      addSegmentedWall(maxZ, minX, maxX, 'x');
      addSegmentedWall(minX, minZ, maxZ, 'z');
      addSegmentedWall(maxX, minZ, maxZ, 'z');

      // Furniture
      for (const item of room.furniture) {
        const mesh = buildFurnitureMesh(item);
        this.worldGroup.add(mesh);
      }
    }
  }

  private buildAmbientDust(quality: GraphicsQuality) {
    if (this.dustPoints) {
      this.scene.remove(this.dustPoints);
      this.dustPoints.geometry.dispose();
    }
    const count = quality === 'low' ? 90 : quality === 'medium' ? 200 : 340;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = 0.4 + Math.random() * 3.1;
      positions[i * 3 + 2] = -26 + Math.random() * 42;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#fde68a',
      size: 0.08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(geo, mat);
    this.dustPoints.frustumCulled = false;
    this.scene.add(this.dustPoints);
  }

  private buildCaseEntities() {
    this.clickables = [];
    this.clearGroup(this.suspectGroup);
    this.suspectMeshes.clear();

    for (const suspect of this.caseData.suspects) {
      const ghost = buildGhostSuspectMesh(suspect);
      ghost.position.set(suspect.position[0], 0, suspect.position[2]);
      ghost.userData.interactTarget = { kind: 'suspect', suspect } satisfies InteractTarget;
      this.suspectGroup.add(ghost);
      this.suspectMeshes.set(suspect.id, ghost);
      this.clickables.push(ghost);
    }

    this.rebuildClueMeshes();
    this.rebuildPuzzleMeshes();
  }

  private rebuildClueMeshes() {
    this.clearGroup(this.clueGroup);
    this.clueMeshes.clear();
    // Refresh clickables with suspects + clues + puzzles
    this.clickables = Array.from(this.suspectMeshes.values());

    for (const clue of this.caseData.clues) {
      const visibleToMe = this.isClueVisibleToMe(clue);
      const discovered = this.discoveredClueIds.has(clue.id);
      const lockReason = this.getClueLockReason(clue);
      const mesh = buildCluePropMesh(clue.propType, visibleToMe && !lockReason, discovered);
      mesh.position.set(clue.position[0], 0, clue.position[2]);
      mesh.userData.interactTarget = {
        kind: 'clue',
        clue,
        visibleToMe,
        lockedReason: lockReason,
      } satisfies InteractTarget;
      this.clueGroup.add(mesh);
      this.clueMeshes.set(clue.id, mesh);
      this.clickables.push(mesh);
    }
  }

  private rebuildPuzzleMeshes() {
    this.clearGroup(this.puzzleGroup);
    this.puzzleMeshes.clear();

    for (const puzzle of this.caseData.puzzles) {
      const solved = this.solvedPuzzleIds.has(puzzle.id);
      const grp = new THREE.Group();
      grp.position.set(puzzle.position[0], 0, puzzle.position[2]);

      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.5, 0.95, 8),
        new THREE.MeshStandardMaterial({ color: '#394052', roughness: 0.7, flatShading: true }),
      );
      ped.position.y = 0.475;
      ped.castShadow = true;

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({
          color: solved ? '#4ade80' : '#38bdf8',
          emissive: solved ? '#16a34a' : '#0284c7',
          emissiveIntensity: 0.75,
          roughness: 0.2,
          metalness: 0.3,
        }),
      );
      crystal.position.y = 1.32;
      crystal.name = 'puzzleCrystal';

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.7, 18),
        new THREE.MeshBasicMaterial({
          color: solved ? '#4ade80' : '#38bdf8',
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;

      grp.add(ped, crystal, ring);
      grp.userData.interactTarget = { kind: 'puzzle', puzzle, solved } satisfies InteractTarget;
      this.puzzleGroup.add(grp);
      this.puzzleMeshes.set(puzzle.id, grp);
      this.clickables.push(grp);
    }
  }

  private rebuildPings(pings: PingBeacon[]) {
    this.clearGroup(this.pingGroup);
    const now = Date.now();
    for (const ping of pings) {
      if (now - ping.at > 12000) continue;
      const color = ping.role === 'staines' ? '#e2a84b' : '#38bdf8';
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.45, 3.2, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      col.position.set(ping.position[0], 1.6, ping.position[2]);
      this.pingGroup.add(col);
    }
  }

  private bindEvents() {
    const dom = this.renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE' || e.code === 'Space') {
        if (this.currentNearTarget) {
          e.preventDefault();
          this.callbacks.onInteract(this.currentNearTarget);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      this.dragging = true;
      this.dragPointerId = e.pointerId;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragDistMoved = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== this.dragPointerId) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragDistMoved += Math.hypot(dx, dy);

      const sens = 0.0055 * this.settings.cameraSensitivity;
      this.cameraYaw -= dx * sens;
      const ySign = this.settings.invertY ? -1 : 1;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * sens * ySign, 0.18, 1.05);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== this.dragPointerId) return;
      const wasTap = this.dragDistMoved < 8;
      this.dragging = false;
      this.dragPointerId = null;

      if (wasTap) {
        const rect = dom.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const hits = this.raycaster.intersectObjects(this.clickables, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData.interactTarget) {
            obj = obj.parent;
          }
          if (obj?.userData.interactTarget) {
            const dist = this.myPos.distanceTo(obj.position);
            if (dist <= 4.4) {
              this.callbacks.onInteract(obj.userData.interactTarget as InteractTarget);
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cameraDist = THREE.MathUtils.clamp(this.cameraDist + e.deltaY * 0.004, 3.4, 8.8);
    };

    const onResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      this.callbacks.onContextLostChange?.(true);
    };
    const onContextRestored = () => {
      this.callbacks.onContextLostChange?.(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    this.unbindListeners = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }

  private unbindListeners: () => void = () => {};

  private animateRigWalk(rig: CharacterRig, phase: number, isMoving: boolean, dt: number) {
    const targetAmp = isMoving ? 0.65 : 0;
    const swing = Math.sin(phase) * targetAmp;
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, swing, 14, dt);
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, -swing, 14, dt);
    rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -swing * 0.75, 14, dt);
    // Keep right lantern arm forward
    rig.rightArm.rotation.x = THREE.MathUtils.damp(
      rig.rightArm.rotation.x,
      -0.45 + swing * 0.25,
      14,
      dt,
    );
    const bob = isMoving ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(phase * 0.35) * 0.015;
    rig.torsoGroup.position.y = 0.68 + bob;
  }

  private updateCamera(dt: number) {
    const horizDist = Math.cos(this.cameraPitch) * this.cameraDist;
    const vertDist = Math.sin(this.cameraPitch) * this.cameraDist + 1.1;

    _camGoal.set(
      this.myPos.x + Math.sin(this.cameraYaw) * horizDist,
      vertDist,
      this.myPos.z + Math.cos(this.cameraYaw) * horizDist,
    );

    const alpha = 1 - Math.exp(-10 * dt);
    this.camera.position.lerp(_camGoal, alpha);
    _lookTarget.set(this.myPos.x, 1.35, this.myPos.z);
    this.camera.lookAt(_lookTarget);
  }

  private updateProximityTarget() {
    let bestDist = 2.65;
    let bestTarget: InteractTarget | null = null;
    let bestKey = '';

    for (const clue of this.caseData.clues) {
      const d = Math.hypot(this.myPos.x - clue.position[0], this.myPos.z - clue.position[2]);
      if (d < bestDist) {
        bestDist = d;
        const visibleToMe = this.isClueVisibleToMe(clue);
        const lockedReason = this.getClueLockReason(clue);
        bestTarget = { kind: 'clue', clue, visibleToMe, lockedReason };
        bestKey = `clue_${clue.id}_${visibleToMe}_${Boolean(lockedReason)}_${this.discoveredClueIds.has(clue.id)}`;
      }
    }

    for (const suspect of this.caseData.suspects) {
      const d = Math.hypot(this.myPos.x - suspect.position[0], this.myPos.z - suspect.position[2]);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { kind: 'suspect', suspect };
        bestKey = `suspect_${suspect.id}`;
      }
    }

    for (const puzzle of this.caseData.puzzles) {
      const d = Math.hypot(this.myPos.x - puzzle.position[0], this.myPos.z - puzzle.position[2]);
      if (d < bestDist) {
        bestDist = d;
        const solved = this.solvedPuzzleIds.has(puzzle.id);
        bestTarget = { kind: 'puzzle', puzzle, solved };
        bestKey = `puzzle_${puzzle.id}_${solved}`;
      }
    }

    if (bestKey !== this.currentNearKey) {
      this.currentNearKey = bestKey;
      this.currentNearTarget = bestTarget;
      this.callbacks.onNearTargetChange(bestTarget);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    // Gather movement input (Keyboard + Touch Joystick)
    let inX = this.joystickInput.joyX;
    let inZ = this.joystickInput.joyY;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) inZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) inZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) inX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) inX += 1;

    const len = Math.hypot(inX, inZ);
    const moving = len > 0.08;
    if (moving) {
      const nx = inX / Math.max(1, len);
      const nz = inZ / Math.max(1, len);

      // Camera-relative movement direction
      const sinY = Math.sin(this.cameraYaw);
      const cosY = Math.cos(this.cameraYaw);
      const worldX = nx * cosY + nz * sinY;
      const worldZ = -nx * sinY + nz * cosY;

      const speed = 4.9 * Math.min(1, len);
      const nextX = this.myPos.x + worldX * speed * dt;
      const nextZ = this.myPos.z + worldZ * speed * dt;

      const [resolvedX, resolvedZ] = resolvePlayerMovement(
        this.myPos.x,
        this.myPos.z,
        nextX,
        nextZ,
        this.caseData.activeRoomIds,
      );
      this.myPos.set(resolvedX, 0, resolvedZ);

      const targetYaw = Math.atan2(worldX, worldZ);
      // Shortest-angle interpolation
      let diff = targetYaw - this.myRotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.myRotY += diff * Math.min(1, 14 * dt);

      this.myWalkPhase += dt * 11;
      this.footstepTimer += dt;
      if (this.footstepTimer > 0.36) {
        this.footstepTimer = 0;
        this.callbacks.onFootstep();
      }
    } else {
      this.myWalkPhase += dt * 2;
    }

    if (this.myRig) {
      this.myRig.root.position.copy(this.myPos);
      this.myRig.root.rotation.y = this.myRotY;
      this.animateRigWalk(this.myRig, this.myWalkPhase, moving, dt);
    }

    // Smooth partner interpolation + screen label projection
    if (this.partnerRig && this.partnerConnected) {
      this.partnerRig.root.position.x = THREE.MathUtils.damp(
        this.partnerRig.root.position.x,
        this.partnerTargetPos.x,
        12,
        dt,
      );
      this.partnerRig.root.position.z = THREE.MathUtils.damp(
        this.partnerRig.root.position.z,
        this.partnerTargetPos.z,
        12,
        dt,
      );
      let rDiff = this.partnerTargetRot - this.partnerRig.root.rotation.y;
      while (rDiff > Math.PI) rDiff -= Math.PI * 2;
      while (rDiff < -Math.PI) rDiff += Math.PI * 2;
      this.partnerRig.root.rotation.y += rDiff * Math.min(1, 12 * dt);

      this.partnerWalkPhase += dt * (this.partnerMoving ? 11 : 2);
      this.animateRigWalk(this.partnerRig, this.partnerWalkPhase, this.partnerMoving, dt);

      if (this.partnerLabelEl) {
        _v1.set(
          this.partnerRig.root.position.x,
          2.25,
          this.partnerRig.root.position.z,
        );
        _v1.project(this.camera);
        if (_v1.z < 1) {
          const w = this.container.clientWidth || window.innerWidth;
          const h = this.container.clientHeight || window.innerHeight;
          const sx = ((_v1.x + 1) / 2) * w;
          const sy = ((-_v1.y + 1) / 2) * h;
          this.partnerLabelEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
          this.partnerLabelEl.style.opacity = '1';
        } else {
          this.partnerLabelEl.style.opacity = '0';
        }
      }
    } else if (this.partnerLabelEl) {
      this.partnerLabelEl.style.opacity = '0';
    }

    // Animate clue props, ghost floats, puzzle crystals
    for (const [id, mesh] of this.clueMeshes.entries()) {
      const floatObj = mesh.getObjectByName('clueFloat');
      if (floatObj) {
        floatObj.position.y = Math.sin(elapsed * 2.4 + id.length) * 0.08;
        floatObj.rotation.y = elapsed * 0.9;
      }
    }
    for (const [id, ghost] of this.suspectMeshes.entries()) {
      const body = ghost.getObjectByName('ghostBody');
      if (body) {
        body.position.y = Math.sin(elapsed * 1.9 + id.length) * 0.1;
      }
      // Face nearest player gently
      _v2.subVectors(this.myPos, ghost.position);
      if (_v2.lengthSq() < 36) {
        ghost.rotation.y = Math.atan2(_v2.x, _v2.z);
      }
    }
    for (const [, puz] of this.puzzleMeshes.entries()) {
      const cry = puz.getObjectByName('puzzleCrystal');
      if (cry) {
        cry.rotation.y = elapsed * 1.1;
        cry.position.y = 1.32 + Math.sin(elapsed * 2.2) * 0.07;
      }
    }

    // Network position update (~16 Hz when moving, or on room change)
    const now = performance.now();
    if (now - this.lastNetEmit > (moving ? 65 : 420)) {
      this.lastNetEmit = now;
      const room = findRoomAtPosition(this.myPos.x, this.myPos.z, this.caseData.activeRoomIds);
      this.callbacks.onLocalMove(
        [
          Number(this.myPos.x.toFixed(2)),
          0,
          Number(this.myPos.z.toFixed(2)),
        ],
        Number(this.myRotY.toFixed(2)),
        moving,
        room?.id || 'foyer',
      );
    }

    this.updateProximityTarget();
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindListeners();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
