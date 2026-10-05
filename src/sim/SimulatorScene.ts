import { TEACHING_PLATFORM, body1SupportHeight } from "../domain";
import {
  AmbientLight,
  AxesHelper,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  Plane,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import { platformHeight, magneticSurfaceHeight, activeTcpOffset, cellBlockSize, MAGNET_SIZE_MM, effectiveForkContactProfile, BODY1_FORK_CONTACT, DEFAULT_TCP_OFFSETS, FORK_SUPPORT_HEIGHT_MM, rad, type ForkContactProfile, type Pose, type ProjectDocument, type JointAngles } from "../domain";
import type { WorkspaceTheme } from "../theme";
import { MG400Kinematics } from "./mg400Kinematics";
import { MODEL_PALETTE, MODEL_VIEWPORT_BACKGROUND, ROBOT_LINK_PALETTE, WORKSPACE_SCENE_PALETTES } from "./modelPalette";
import { createReferenceBlock, setWorkpieceColor } from "./blockMarker";
import { createFallbackForkGeometry, prepareFlangeMountedToolGeometry } from "./toolMount";

export type SceneState = {
  joints: JointAngles;
  project: ProjectDocument;
  blockPosition: { x: number; y: number };
  attached: boolean;
  attachedCellBlockId?: string | null;
  target: Pose | null;
};

export type SceneStatus = { kind: "loading" | "ready" | "error"; message?: string; progress?: number };
export type LocalToolMeshes = { magnet?: ArrayBuffer; fork?: ArrayBuffer; block?: ArrayBuffer; blockProfile?: ForkContactProfile; bundledFork?: boolean; bundledMagnet?: boolean; names?: Partial<Record<"magnet" | "fork" | "block", string>> };

export function viewportVerticalFov(baseFov: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect >= 1 || aspect <= 0) return baseFov;
  return Math.min(75, (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / aspect) * 180) / Math.PI);
}

const VIEWPORT_FOV = 46;

export class SimulatorScene {
  private readonly scene = new Scene();
  private readonly table: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly bed: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly grid: GridHelper;
  private readonly ambient: AmbientLight;
  private readonly keyLight: DirectionalLight;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly robotRoot = new Group();
  private readonly loadingRobot = new Group();
  private readonly toolGroup = new Group();
  private readonly blockGroup = new Group();
  private readonly forkFixtures = new Group();
  private readonly pickupStand = new Group();
  private readonly dropStand = new Group();
  private readonly block: Mesh<BufferGeometry, MeshStandardMaterial> = createReferenceBlock();
  private readonly proceduralBlockGeometry = this.block.geometry.clone();
  private readonly magneticBlockGeometry = new BoxGeometry(MAGNET_SIZE_MM.x, MAGNET_SIZE_MM.y, MAGNET_SIZE_MM.z);
  private localForkBlockGeometry?: BufferGeometry;
  private readonly teachingPlatform = new Mesh(new BoxGeometry(TEACHING_PLATFORM.width, TEACHING_PLATFORM.depth, 1), new MeshStandardMaterial({ color: "#71868d", roughness: 0.6 }));
  private readonly magnetStands = new Map<string, Mesh>();
  private readonly additionalBlocks = new Map<string, Mesh>();
  private appliedLocalMeshes?: LocalToolMeshes;
  private readonly target = new Group();
  private dropPad?: Mesh;
  private dropRing?: Mesh;
  private robot?: URDFRobot;
  private magnetMesh?: Mesh;
  private forkMesh?: Mesh;
  private tcpMarker?: Mesh;
  private kinematics?: MG400Kinematics;
  private state?: SceneState;
  private raf = 0;
  private resizeRaf = 0;
  private resizeObserver?: ResizeObserver;
  private readonly resize = () => this.resizeCanvas();

  private constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = new Color(MODEL_VIEWPORT_BACKGROUND);
    this.camera = new PerspectiveCamera(VIEWPORT_FOV, 1, 1, 6000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(560, -720, 520);
    this.camera.lookAt(150, 0, 115);
    // Keep the last frame available to embedded-browser screenshot/readback paths.
    // Some WebKit/Electron and browser automation compositors otherwise capture
    // only the cleared WebGL back buffer even while the scene itself is rendered.
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setClearColor(MODEL_VIEWPORT_BACKGROUND);

    const ambient = this.ambient = new AmbientLight("#d9eceb", 0.62);
    const key = this.keyLight = new DirectionalLight("#fff2d8", 1.15);
    key.position.set(250, -360, 650);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -600;
    key.shadow.camera.right = 600;
    key.shadow.camera.top = 600;
    key.shadow.camera.bottom = -600;
    this.scene.add(ambient, key);

    const table = this.table = new Mesh(
      new BoxGeometry(1050, 820, 40),
      new MeshStandardMaterial({ color: "#252f32", roughness: 0.82, metalness: 0.08 }),
    );
    table.position.set(145, 0, -20);
    table.receiveShadow = true;
    this.scene.add(table);

    const grid = this.grid = new GridHelper(1200, 48, "#3b4d4e", "#253436");
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.7;
    this.scene.add(grid);

    const bed = this.bed = new Mesh(
      new BoxGeometry(570, 420, 5),
      new MeshStandardMaterial({ color: "#182225", roughness: 0.64, metalness: 0.1 }),
    );
    bed.position.set(245, 0, -2.5);
    this.scene.add(bed);

    const dropPad = new Mesh(
      new CylinderGeometry(48, 48, 3, 48),
      new MeshStandardMaterial({ color: "#235c57", roughness: 0.5, metalness: 0.1 }),
    );
    dropPad.rotation.x = Math.PI / 2;
    dropPad.position.set(250, 80, -1.5);
    this.dropPad = dropPad;
    this.scene.add(dropPad);
    const dropRing = new Mesh(
      new RingGeometry(42, 44, 48),
      new MeshStandardMaterial({ color: "#72d7c1", emissive: "#13312c", roughness: 0.35, side: 2 }),
    );
    dropRing.position.set(250, 80, 0.2);
    this.dropRing = dropRing;
    this.scene.add(dropRing);

    this.scene.add(this.robotRoot);
    this.robotRoot.visible = false;
    this.scene.add(this.toolGroup);
    this.toolGroup.visible = false;
    this.createLoadingPlaceholder();
    this.scene.add(this.blockGroup);
    this.pickupStand.add(...this.makeForkStandPads());
    this.dropStand.add(...this.makeForkStandPads());
    this.forkFixtures.add(this.pickupStand, this.dropStand);
    this.scene.add(this.forkFixtures);
    this.block.castShadow = true;
    this.block.receiveShadow = true;
    this.blockGroup.add(this.block);
    this.makeTargetMarker();
    this.scene.add(this.target);

    const axes = new AxesHelper(80);
    axes.position.set(-240, -320, 1);
    this.scene.add(axes);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(150, 0, 115);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 1800;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(this.resize);
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", this.resize);
    this.resizeCanvas();
    this.renderFrame();
  }

  static async create(canvas: HTMLCanvasElement, urdfXml: string, onStatus: (status: SceneStatus) => void, workspaceTheme: WorkspaceTheme = "light") {
    let view: SimulatorScene | undefined;
    try {
      view = new SimulatorScene(canvas);
      view.setTheme(workspaceTheme);
      onStatus({ kind: "loading", message: "Loading the Dobot MG400 model…", progress: 0 });
      const path = "/models/mg400/mg400_description/";
      const loader = new URDFLoader();
      loader.packages = { mg400_description: path.slice(0, -1) };
      loader.workingPath = path + "urdf/";
      const meshLoads: Promise<void>[] = [];
      let loaded = 0;
      let failed = false;
      loader.loadMeshCb = (url, manager, material, done) => {
        meshLoads.push(new Promise<void>((resolve, reject) => {
          loader.defaultMeshLoader(url, manager, material, (mesh, error) => {
            if (error || !mesh || (mesh instanceof Mesh && !mesh.geometry.getAttribute("position")?.count)) {
              failed = true;
              reject(error ?? new Error(`Could not load MG400 mesh: ${url}`));
              return;
            }
            done(mesh);
            if (!failed) onStatus({ kind: "loading", message: "Loading MG400 visual meshes…", progress: Math.round((++loaded / meshLoads.length) * 100) });
            resolve();
          });
        }));
      };
      const robot = loader.parse(urdfXml);
      // FileLoader deduplicates in-flight URLs across managers. Await each
      // actual mesh attachment so overlapping/remounted scenes also complete.
      if (meshLoads.length === 0) throw new Error("MG400 model has no visual meshes.");
      await Promise.all(meshLoads);
      view.robot = robot;
      view.kinematics = MG400Kinematics.fromUrdf(urdfXml);
      view.prepareRobot(robot);
      onStatus({ kind: "ready" });
      return view;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onStatus({ kind: "error", message });
      // Keep the renderer and project-authored loading silhouette mounted so
      // the workcell remains visible and usable when vendor assets fail.
      if (view) return view;
      throw error;
    }
  }

  setTheme(theme: WorkspaceTheme) {
    const palette = WORKSPACE_SCENE_PALETTES[theme];
    (this.scene.background as Color).set(palette.background);
    this.renderer.setClearColor(palette.background);
    this.table.material.color.set(palette.table);
    this.bed.material.color.set(palette.bed);
    this.ambient.intensity = palette.ambient;
    this.keyLight.intensity = palette.key;
    const position = this.grid.geometry.getAttribute("position");
    const colors = this.grid.geometry.getAttribute("color");
    const major = new Color(palette.gridMajor), minor = new Color(palette.gridMinor);
    for (let i = 0; i < position.count; i += 2) {
      const centreLine = Math.floor(i / 2) % 2 === 0 ? Math.abs(position.getZ(i)) < 0.001 : Math.abs(position.getX(i)) < 0.001;
      const color = centreLine ? major : minor;
      colors.setXYZ(i, color.r, color.g, color.b);
      colors.setXYZ(i + 1, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  }

  private createLoadingPlaceholder() {
    const material = new MeshStandardMaterial({ color: "#94aaa4", roughness: 0.52, metalness: 0.16 });
    const addBox = (geometry: BoxGeometry, position: [number, number, number], rotationY = 0) => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.y = rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.loadingRobot.add(mesh);
    };
    const base = new Mesh(new CylinderGeometry(72, 82, 92, 24), material);
    base.rotation.x = Math.PI / 2;
    base.position.set(0, 0, 46);
    this.loadingRobot.add(base);
    addBox(new BoxGeometry(118, 92, 28), [0, 0, 106]);
    addBox(new BoxGeometry(190, 64, 54), [91, 0, 168], -0.14);
    addBox(new BoxGeometry(165, 48, 44), [253, 0, 175], 0.30);
    addBox(new BoxGeometry(44, 58, 45), [337, 0, 128]);
    const placeholderFork = createFallbackForkGeometry();
    prepareFlangeMountedToolGeometry(placeholderFork);
    const fork = new Mesh(placeholderFork, new MeshStandardMaterial({ color: MODEL_PALETTE.fork, roughness: 0.42, metalness: 0.42 }));
    fork.position.set(358, 0, 103);
    fork.castShadow = true;
    this.loadingRobot.add(fork);
    this.scene.add(this.loadingRobot);
  }

  private prepareRobot(robot: URDFRobot) {
    robot.scale.setScalar(1000);
    for (const joint of Object.values(robot.joints)) joint.ignoreLimits = true;
    robot.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      let owner: Object3D | null = object;
      while (owner && !(owner as Object3D & { isURDFLink?: boolean }).isURDFLink) owner = owner.parent;
      const linkName = owner?.name ?? object.name;
      object.material = new MeshStandardMaterial({
        color: ROBOT_LINK_PALETTE[linkName as keyof typeof ROBOT_LINK_PALETTE] ?? MODEL_PALETTE.unmappedLink,
        roughness: 0.39,
        metalness: 0.24,
      });
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.robotRoot.add(robot);
    this.robotRoot.visible = true;
    this.loadingRobot.visible = false;
    this.toolGroup.visible = true;
    const fallbackMagnet = new CylinderGeometry(11, 11, 6, 24);
    fallbackMagnet.rotateX(Math.PI / 2);
    this.prepareToolMeshes(fallbackMagnet, createFallbackForkGeometry());
    const tcp = new Mesh(
      new SphereGeometry(5, 20, 14),
      new MeshStandardMaterial({ color: MODEL_PALETTE.tcp, emissive: "#392910", roughness: 0.3 }),
    );
    const tcpOffset = this.state ? activeTcpOffset(this.state.project.tool) : DEFAULT_TCP_OFFSETS.magnet;
    tcp.position.set(tcpOffset.x, tcpOffset.y, tcpOffset.z);
    this.tcpMarker = tcp;
    this.toolGroup.add(tcp);
  }

  private prepareToolMeshes(magnetGeometry: BufferGeometry, forkGeometry: BufferGeometry) {
    for (const geometry of [magnetGeometry, forkGeometry]) {
      prepareFlangeMountedToolGeometry(geometry);
    }
    this.magnetMesh = new Mesh(magnetGeometry, new MeshStandardMaterial({ color: MODEL_PALETTE.magnet, roughness: 0.4, metalness: 0.38 }));
    this.forkMesh = new Mesh(forkGeometry, new MeshStandardMaterial({ color: MODEL_PALETTE.fork, roughness: 0.28, metalness: 0.78 }));
    this.magnetMesh.castShadow = this.magnetMesh.receiveShadow = true;
    this.forkMesh.castShadow = this.forkMesh.receiveShadow = true;
    this.magnetMesh.name = "Magnetic pickup tool / 磁吸工具";
    this.forkMesh.name = "Passive fork / 無動力叉臂";
    this.toolGroup.add(this.magnetMesh, this.forkMesh);
  }

  private prepareLocalBlock(geometry: BufferGeometry) {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) return;
    // STL has no scene origin: center its footprint and place its lowest surface
    // on the simulator's support datum. Source coordinates are millimetres.
    geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, -bounds.min.z);
    geometry.computeVertexNormals();
    this.localForkBlockGeometry?.dispose();
    this.localForkBlockGeometry = geometry;
  }

  private makeTargetMarker() {
    const halo = new Mesh(
      new RingGeometry(9, 11, 40),
      new MeshStandardMaterial({ color: MODEL_PALETTE.target, emissive: "#214941", side: 2 }),
    );
    halo.position.z = 0;
    this.target.add(halo);
    const point = new Mesh(
      new SphereGeometry(4, 18, 12),
      new MeshStandardMaterial({ color: MODEL_PALETTE.targetCenter, emissive: "#62b8a5" }),
    );
    this.target.add(point);
  }

  private makeForkStandPads(): Mesh[] {
    const material = new MeshStandardMaterial({ color: "#667c75", roughness: 0.52, metalness: 0.42 });
    return [
      [-15, -18, 10],
      [-15, 18, 10],
      [15, 0, 10],
    ].map(([x, y, z]) => {
      const pad = new Mesh(new BoxGeometry(10, 3, FORK_SUPPORT_HEIGHT_MM), material);
      pad.position.set(x, y, z);
      pad.castShadow = true;
      pad.receiveShadow = true;
      return pad;
    });
  }

  setState(state: SceneState) {
    this.state = state;
    if (this.robot) {
      this.robot.setJointValues({ j1: state.joints[0], j2: state.joints[1], j3: state.joints[2], j4: state.joints[3] });
    }
    if (this.magnetMesh) this.magnetMesh.visible = state.project.tool.mode === "magnet";
    if (this.forkMesh) this.forkMesh.visible = state.project.tool.mode === "fork";
    this.updateBlockParent();
  }

  setLocalToolMeshes(localMeshes: LocalToolMeshes) {
    if (this.appliedLocalMeshes === localMeshes) return;
    const previousMeshes = this.appliedLocalMeshes;
    this.appliedLocalMeshes = localMeshes;
    const loader = new STLLoader();
    const replacements: Array<[ArrayBuffer | undefined, Mesh | undefined, ArrayBuffer | undefined]> = [
      [localMeshes.magnet, this.magnetMesh, previousMeshes?.magnet],
      [localMeshes.fork, this.forkMesh, previousMeshes?.fork],
    ];
    replacements.forEach(([bytes, mesh, previousBytes]) => {
      if (!bytes || !mesh || bytes === previousBytes) return;
      const geometry = loader.parse(bytes);
      prepareFlangeMountedToolGeometry(geometry);
      const previous = mesh.geometry;
      mesh.geometry = geometry;
      previous.dispose();
    });
    if (localMeshes.block && localMeshes.block !== previousMeshes?.block) {
      const geometry = loader.parse(localMeshes.block);
      this.prepareLocalBlock(geometry);
      this.updateBlockParent();
    }
  }

  resetCamera() {
    this.camera.position.set(560, -720, 520);
    this.camera.up.set(0, 0, 1);
    this.controls.target.set(150, 0, 115);
    this.controls.update();
  }

  focusPlacedWorkpieces() {
    const state = this.state;
    if (!state) return;
    const placed = state.project.scene.blocks.filter(block => block.source === "output");
    if (!placed.length) return;
    const baseBlock = state.project.scene.blocks.find(block => !block.kind || block.kind === "block");

    this.scene.updateMatrixWorld(true);
    const bounds = new Box3();
    for (const block of placed) {
      const mesh = baseBlock?.id === block.id
        ? this.block
        : this.additionalBlocks.get(block.id);
      if (!mesh?.visible) continue;
      bounds.expandByObject(mesh);
    }
    if (bounds.isEmpty()) return;

    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    // Keep a clear top-side view so both the orientation marker and each
    // stack level remain visible while framing the full output arrangement.
    const direction = new Vector3(0.56, 0.65, 0.51).normalize();
    const forward = direction.clone().negate();
    const right = forward.clone().cross(new Vector3(0, 0, 1)).normalize();
    const cameraUp = right.clone().cross(forward).normalize();
    const halfWidth = (Math.abs(right.x) * size.x + Math.abs(right.y) * size.y + Math.abs(right.z) * size.z) / 2;
    const halfHeight = (Math.abs(cameraUp.x) * size.x + Math.abs(cameraUp.y) * size.y + Math.abs(cameraUp.z) * size.z) / 2;
    const halfDepth = (Math.abs(direction.x) * size.x + Math.abs(direction.y) * size.y + Math.abs(direction.z) * size.z) / 2;
    const verticalFov = this.camera.fov * Math.PI / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const fitDistance = Math.max(halfHeight / Math.tan(verticalFov / 2), halfWidth / Math.tan(horizontalFov / 2));
    const distance = Math.max(this.controls.minDistance, halfDepth + fitDistance * 1.18);

    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.lookAt(center);
    this.controls.update();
  }

  tablePositionFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const pointer = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = new Vector3();
    const surfaceZ = this.state ? platformHeight(this.state.project.scene) : 0;
    if (!raycaster.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -surfaceZ), hit)) return null;
    if (Math.abs(hit.x) > 500 || Math.abs(hit.y) > 500) return null;
    return { x: Number(hit.x.toFixed(1)), y: Number(hit.y.toFixed(1)) };
  }

  private updateBlockParent() {
    const state = this.state;
    if (!state) return;
    const isFork = state.project.tool.mode === "fork";
    const cellBlocks = state.project.scene.blocks ?? [];
    const magneticStandHeight = magneticSurfaceHeight(state.project.scene);
    const platformZ = platformHeight(state.project.scene);
    if (!this.teachingPlatform.parent) this.blockGroup.add(this.teachingPlatform);
    this.teachingPlatform.name = "Fixed 340×320×110 teaching platform / 固定教學平台";
    this.teachingPlatform.scale.set(1, 1, 110);
    this.teachingPlatform.position.set(TEACHING_PLATFORM.x, TEACHING_PLATFORM.y, TEACHING_PLATFORM.top/2);
    this.teachingPlatform.visible = true;
    const baseBlock = cellBlocks.find((block) => !block.kind || block.kind === "block");
    const baseSize = cellBlockSize(baseBlock, state.project.tool.mode);
    const useLocalForkBlock = Boolean(this.localForkBlockGeometry) && (isFork || baseBlock?.geometry === "body1");
    this.block.geometry = useLocalForkBlock ? this.localForkBlockGeometry! : baseSize.z === 4 ? this.magneticBlockGeometry : this.proceduralBlockGeometry;
    this.block.name = useLocalForkBlock ? "Grooved fork block / 槽積木 (Body1)" : `${baseSize.x} x ${baseSize.y} x ${baseSize.z} mm workpiece`;
    setWorkpieceColor(this.block, baseBlock?.color ?? "neutral");
    for (const marker of this.block.children) {
      if (marker.name.includes("top")) marker.position.z = useLocalForkBlock ? 40.8 : baseSize.z / 2 + 0.8;
      else { marker.position.y = Math.sign(marker.position.y) * (baseSize.y / 2 + 0.25); marker.scale.y = Math.min(1, baseSize.z / 12); }
    }
    this.forkFixtures.visible = isFork && body1SupportHeight(state.project.scene) > 0;
    this.pickupStand.visible = false;
    this.dropStand.visible = false;

    this.block.visible = Boolean(baseBlock) && (baseBlock?.geometry !== "body1" || Boolean(this.localForkBlockGeometry));
    for (const [id, stand] of this.magnetStands) stand.visible = platformZ === 0 && cellBlocks.some((block) => block.id === id && cellBlockSize(block, state.project.tool.mode).z === 4);
    for (const block of cellBlocks.filter((block) => platformZ === 0 && cellBlockSize(block, state.project.tool.mode).z === 4)) {
      let stand = this.magnetStands.get(block.id);
      if (!stand) {
        stand = new Mesh(new BoxGeometry(38, 38, 1), new MeshStandardMaterial({color: "#71868d", roughness: 0.6}));
        stand.name = "Magnetic teaching stand / 磁吸片教學座";
        this.magnetStands.set(block.id, stand);
        this.blockGroup.add(stand);
      }
      stand.scale.z = magneticStandHeight;
      stand.name = `${magneticStandHeight} mm magnetic teaching stand / 磁吸片教學座`;
      stand.position.set(block.position.x, block.position.y, (block.z ?? 0) + magneticStandHeight / 2);
      stand.rotation.z = rad(block.r);
      stand.visible = true;
    }
    for (const block of cellBlocks.filter((block) => block.id !== baseBlock?.id)) {
      let mesh = this.additionalBlocks.get(block.id);
      const kind = block.geometry === "body1" ? `body1-${Boolean(this.localForkBlockGeometry)}` : block.kind ?? state.project.tool.mode;
      const body1 = block.geometry === "body1" && Boolean(this.localForkBlockGeometry);
      const size = cellBlockSize(block, state.project.tool.mode);
      if (mesh && mesh.userData.kind !== kind) {
        mesh.removeFromParent();
        mesh.traverse((object) => { if (object instanceof Mesh) { object.geometry.dispose(); object.material.dispose(); } });
        mesh = undefined;
      }
      if (!mesh) {
        mesh = createReferenceBlock(block.color, size);
        if (body1) {
          mesh.geometry.dispose();
          mesh.geometry = this.localForkBlockGeometry!.clone();
          mesh.name = "Supplied Body1 40×40×40 / 原裝槽積木";
          for (const marker of mesh.children) if (marker.name.includes("top")) marker.position.z = 40.8;
        }
        mesh.userData.kind = kind;
        mesh.userData.cellBlockId = block.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.additionalBlocks.set(block.id, mesh);
        this.blockGroup.add(mesh);
      }
      mesh.position.set(block.position.x, block.position.y, (block.z ?? 0) + (size.z === 4 ? magneticStandHeight : platformZ + (isFork ? (block.geometry === "body1" ? body1SupportHeight(state.project.scene) : FORK_SUPPORT_HEIGHT_MM) : 0)) + (block.stackLevel ?? 0) * size.z + (body1 ? 0 : size.z / 2));
      if (!(state.attached && state.attachedCellBlockId === block.id)) mesh.rotation.z = rad(block.r);
      if (!(state.attached && state.attachedCellBlockId === block.id) && mesh.parent !== this.blockGroup) this.blockGroup.add(mesh);
      mesh.visible = block.geometry !== "body1" || Boolean(this.localForkBlockGeometry);
      setWorkpieceColor(mesh as Mesh<BufferGeometry, MeshStandardMaterial>, block.color);
    }
    for (const [id, mesh] of this.additionalBlocks) {
      if (!cellBlocks.some((block) => block.id === id)) mesh.visible = false;
    }
    this.pickupStand.position.set(state.blockPosition.x, state.blockPosition.y, platformZ);
    this.dropStand.position.set(state.project.scene.drop.x, state.project.scene.drop.y, platformZ);
    this.pickupStand.rotation.z = this.pointRotation(state.project, "PickPoint");
    this.dropStand.rotation.z = this.pointRotation(state.project, "PlacePoint");
    const attachedMesh = state.attachedCellBlockId
      ? (baseBlock?.id === state.attachedCellBlockId ? this.block : this.additionalBlocks.get(state.attachedCellBlockId) ?? this.block)
      : this.block;
    if (baseBlock && attachedMesh !== this.block) {
      this.block.position.set(baseBlock.position.x, baseBlock.position.y, (baseBlock.z ?? 0) + (baseSize.z === 4 ? magneticStandHeight : platformZ + (isFork ? (useLocalForkBlock ? body1SupportHeight(state.project.scene) : FORK_SUPPORT_HEIGHT_MM) : 0)) + (baseBlock.stackLevel ?? 0) * baseSize.z + (useLocalForkBlock ? 0 : baseSize.z / 2));
      this.block.rotation.z = rad(baseBlock.r);
    }
    if (state.attached) {
      if (attachedMesh !== this.block && this.block.parent !== this.blockGroup) this.blockGroup.add(this.block);
      if (attachedMesh.parent !== this.toolGroup) {
        this.scene.updateMatrixWorld(true);
        this.toolGroup.attach(attachedMesh);
      }
      const offset = activeTcpOffset(state.project.tool);
      const localStl = isFork && Boolean(this.localForkBlockGeometry) && (attachedMesh === this.block || cellBlocks.find(block => block.id === state.attachedCellBlockId)?.geometry === "body1");
      const carriedSize = cellBlockSize(cellBlocks.find((block) => block.id === state.attachedCellBlockId), state.project.tool.mode);
      const centerDelta = localStl ? (effectiveForkContactProfile(this.appliedLocalMeshes?.blockProfile ?? "reference", cellBlocks, state.attachedCellBlockId ?? baseBlock?.id) === "body1" ? -BODY1_FORK_CONTACT.bottomOffset : 0) : (isFork ? carriedSize.z / 2 : -carriedSize.z / 2);
      attachedMesh.position.set(offset.x, offset.y, offset.z + centerDelta);
      if (!isFork) attachedMesh.rotation.set(0, 0, 0);
      if (attachedMesh !== this.block && baseBlock) this.block.visible = true;
    } else if (baseBlock) {
      if (this.block.parent !== this.blockGroup) this.blockGroup.add(this.block);
      const position = baseBlock.position ?? state.blockPosition;
      const supportHeight = baseSize.z === 4 ? magneticStandHeight : platformZ + (isFork ? (useLocalForkBlock ? body1SupportHeight(state.project.scene) : FORK_SUPPORT_HEIGHT_MM) : 0);
      this.block.position.set(position.x, position.y, (baseBlock.z ?? 0) + supportHeight + (baseBlock.stackLevel ?? 0) * baseSize.z + (useLocalForkBlock ? 0 : baseSize.z / 2));
      this.block.rotation.z = rad(baseBlock.r);
    } else {
      this.block.visible = false;
    }
    if (state.target) {
      this.target.visible = true;
      this.target.position.set(state.target.x, state.target.y, state.target.z + 1);
    } else {
      this.target.visible = false;
    }
    this.dropPad?.position.set(state.project.scene.drop.x, state.project.scene.drop.y, platformZ - 1.5);
    this.dropRing?.position.set(state.project.scene.drop.x, state.project.scene.drop.y, platformZ + 0.2);
  }

  private pointRotation(project: ProjectDocument, name: string): number {
    const point = project.points.find((candidate) => candidate.name === name && candidate.kind === "cartesian");
    return point?.kind === "cartesian" ? rad(point.pose.r) : 0;
  }

  private applyRobotAndTool() {
    if (!this.robot || !this.kinematics || !this.state) return;
    const { joints, project } = this.state;
    this.robot.setJointValues({ j1: joints[0], j2: joints[1], j3: joints[2], j4: joints[3] });
    const tcpOffset = activeTcpOffset(project.tool);
    this.tcpMarker?.position.set(tcpOffset.x, tcpOffset.y, tcpOffset.z);
    this.toolGroup.matrixAutoUpdate = false;
    this.toolGroup.matrix.copy(this.kinematics.flangeMatrix(joints, project.tool.flangeOffset));
    this.toolGroup.matrixWorldNeedsUpdate = true;
    this.updateBlockParent();
  }

  private renderFrame = () => {
    this.raf = requestAnimationFrame(this.renderFrame);
    this.applyRobotAndTool();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resizeCanvas() {
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.fov = viewportVerticalFov(VIEWPORT_FOV, this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.resizeRaf);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.resize);
    this.controls.dispose();
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry instanceof BufferGeometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else if (material) material.dispose();
    });
    if (this.block.geometry !== this.proceduralBlockGeometry) this.proceduralBlockGeometry.dispose();
    if (this.localForkBlockGeometry && this.block.geometry !== this.localForkBlockGeometry) this.localForkBlockGeometry.dispose();
    if (this.block.geometry !== this.magneticBlockGeometry) this.magneticBlockGeometry.dispose();
    this.renderer.dispose();
  }
}
