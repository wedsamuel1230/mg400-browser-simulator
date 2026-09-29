import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  LoadingManager,
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
import { activeTcpOffset, DEFAULT_TCP_OFFSETS, FORK_SUPPORT_HEIGHT_MM, rad, type Pose, type ProjectDocument, type JointAngles } from "../domain";
import { BLOCK_SIZE_MM } from "../domain";
import { MG400Kinematics } from "./mg400Kinematics";
import { MODEL_PALETTE, MODEL_VIEWPORT_BACKGROUND, ROBOT_LINK_PALETTE } from "./modelPalette";
import { createMagnetPuck, createReferenceBlock } from "./blockMarker";
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
export type LocalToolMeshes = { magnet?: ArrayBuffer; fork?: ArrayBuffer; block?: ArrayBuffer };

export function viewportVerticalFov(baseFov: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect >= 1 || aspect <= 0) return baseFov;
  return Math.min(75, (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / aspect) * 180) / Math.PI);
}

export class SimulatorScene {
  private readonly scene = new Scene();
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
  private localForkBlockGeometry?: BufferGeometry;
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
    this.camera = new PerspectiveCamera(42, 1, 1, 6000);
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

    const ambient = new AmbientLight("#d9eceb", 0.62);
    const key = new DirectionalLight("#fff2d8", 1.15);
    key.position.set(250, -360, 650);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -600;
    key.shadow.camera.right = 600;
    key.shadow.camera.top = 600;
    key.shadow.camera.bottom = -600;
    this.scene.add(ambient, key);

    const table = new Mesh(
      new BoxGeometry(1050, 820, 40),
      new MeshStandardMaterial({ color: "#252f32", roughness: 0.82, metalness: 0.08 }),
    );
    table.position.set(145, 0, -20);
    table.receiveShadow = true;
    this.scene.add(table);

    const grid = new GridHelper(1200, 48, "#3b4d4e", "#253436");
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.7;
    this.scene.add(grid);

    const bed = new Mesh(
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

  static async create(canvas: HTMLCanvasElement, onStatus: (status: SceneStatus) => void) {
    let view: SimulatorScene | undefined;
    try {
      view = new SimulatorScene(canvas);
      onStatus({ kind: "loading", message: "Loading the Dobot MG400 model…", progress: 0 });
      const path = "/models/mg400/mg400_description/";
      const loadingManager = new LoadingManager();
      loadingManager.onProgress = (_url, loaded, total) => onStatus({
        kind: "loading",
        message: "Loading MG400 visual meshes…",
        progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
      });
      const modelMeshesLoaded = new Promise<void>((resolve, reject) => {
        loadingManager.onLoad = () => resolve();
        loadingManager.onError = (url) => reject(new Error(`Could not load MG400 mesh: ${url}`));
      });
      const loader = new URDFLoader(loadingManager);
      loader.packages = { mg400_description: path };
      const [robot, urdfResponse] = await Promise.all([
        loader.loadAsync(path + "urdf/mg400_description.urdf"),
        fetch(path + "urdf/mg400_description.urdf"),
      ]);
      if (!urdfResponse.ok) throw new Error("Could not read the bundled MG400 URDF.");
      // URDFLoader returns the link tree before its nested STL requests have
      // necessarily attached their meshes. Color only after those callbacks.
      await modelMeshesLoaded;
      view.robot = robot;
      view.kinematics = MG400Kinematics.fromUrdf(await urdfResponse.text());
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
    this.appliedLocalMeshes = localMeshes;
    const loader = new STLLoader();
    const replacements: Array<[ArrayBuffer | undefined, Mesh | undefined]> = [
      [localMeshes.magnet, this.magnetMesh],
      [localMeshes.fork, this.forkMesh],
    ];
    replacements.forEach(([bytes, mesh]) => {
      if (!bytes || !mesh) return;
      const geometry = loader.parse(bytes);
      prepareFlangeMountedToolGeometry(geometry);
      const previous = mesh.geometry;
      mesh.geometry = geometry;
      previous.dispose();
    });
    if (localMeshes.block) {
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

  tablePositionFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const pointer = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = new Vector3();
    if (!raycaster.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), 0), hit)) return null;
    if (Math.abs(hit.x) > 500 || Math.abs(hit.y) > 500) return null;
    return { x: Number(hit.x.toFixed(1)), y: Number(hit.y.toFixed(1)) };
  }

  private updateBlockParent() {
    const state = this.state;
    if (!state) return;
    const isFork = state.project.tool.mode === "fork";
    const useLocalForkBlock = isFork && Boolean(this.localForkBlockGeometry);
    this.block.geometry = useLocalForkBlock ? this.localForkBlockGeometry! : this.proceduralBlockGeometry;
    this.block.name = useLocalForkBlock ? "Locally imported fork-task workpiece" : "neutral 40 x 40 x 15 mm reference block";
    this.forkFixtures.visible = isFork;
    const cellBlocks = state.project.scene.blocks ?? [];
    const baseBlock = cellBlocks[0]?.kind === "puck" ? undefined : cellBlocks[0];
    this.block.visible = Boolean(baseBlock);
    for (const block of (baseBlock ? cellBlocks.slice(1) : cellBlocks)) {
      let mesh = this.additionalBlocks.get(block.id);
      if (!mesh) {
        mesh = block.kind === "puck" ? createMagnetPuck(block.color) : createReferenceBlock(block.color);
        mesh.userData.cellBlockId = block.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.additionalBlocks.set(block.id, mesh);
        this.blockGroup.add(mesh);
      }
      mesh.position.set(block.position.x, block.position.y, (block.z ?? 0) + (isFork ? FORK_SUPPORT_HEIGHT_MM : 0) + (block.stackLevel ?? 0) * BLOCK_SIZE_MM.z + (block.kind === "puck" ? 4 : BLOCK_SIZE_MM.z / 2));
      mesh.rotation.z = rad(block.r);
      if (!(state.attached && state.attachedCellBlockId === block.id) && mesh.parent !== this.blockGroup) this.blockGroup.add(mesh);
      mesh.visible = !state.attached || state.attachedCellBlockId === block.id;
    }
    for (const [id, mesh] of this.additionalBlocks) {
      if (!cellBlocks.some((block) => block.id === id)) mesh.visible = false;
    }
    this.pickupStand.position.set(state.blockPosition.x, state.blockPosition.y, 0);
    this.dropStand.position.set(state.project.scene.drop.x, state.project.scene.drop.y, 0);
    this.pickupStand.rotation.z = this.pointRotation(state.project, "PickPoint");
    this.dropStand.rotation.z = this.pointRotation(state.project, "PlacePoint");
    const attachedMesh = state.attachedCellBlockId
      ? (baseBlock?.id === state.attachedCellBlockId ? this.block : this.additionalBlocks.get(state.attachedCellBlockId) ?? this.block)
      : this.block;
    if (state.attached) {
      if (attachedMesh !== this.block && this.block.parent !== this.blockGroup) this.blockGroup.add(this.block);
      if (attachedMesh.parent !== this.toolGroup) this.toolGroup.add(attachedMesh);
      const offset = activeTcpOffset(state.project.tool);
      const localStl = isFork && Boolean(this.localForkBlockGeometry);
      const centerDelta = localStl ? 0 : (isFork ? BLOCK_SIZE_MM.z / 2 : -BLOCK_SIZE_MM.z / 2);
      attachedMesh.position.set(offset.x, offset.y, offset.z + centerDelta);
      attachedMesh.rotation.set(0, 0, 0);
      if (attachedMesh !== this.block && baseBlock) this.block.visible = true;
    } else if (baseBlock) {
      if (this.block.parent !== this.blockGroup) this.blockGroup.add(this.block);
      const position = baseBlock.position ?? state.blockPosition;
      const supportHeight = isFork ? FORK_SUPPORT_HEIGHT_MM : 0;
      this.block.position.set(position.x, position.y, supportHeight + (baseBlock.stackLevel ?? 0) * BLOCK_SIZE_MM.z + (useLocalForkBlock ? 0 : BLOCK_SIZE_MM.z / 2));
      this.block.rotation.z = rad(baseBlock.r);
    } else {
      this.block.visible = false;
    }
    if (state.target) {
      this.target.visible = true;
      this.target.position.set(state.target.x, state.target.y, state.target.z);
    } else {
      this.target.visible = false;
    }
    this.dropPad?.position.set(state.project.scene.drop.x, state.project.scene.drop.y, -1.5);
    this.dropRing?.position.set(state.project.scene.drop.x, state.project.scene.drop.y, 0.2);
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
    this.camera.fov = viewportVerticalFov(42, this.camera.aspect);
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
    this.renderer.dispose();
  }
}
