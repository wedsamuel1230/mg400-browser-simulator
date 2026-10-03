import {
  Matrix4,
  Quaternion,
  Vector3,
  Euler,
} from "three";
import {
  JOINT_LIMITS_DEG,
  deg,
  rad,
  type JointAngles,
  type Pose,
} from "../domain";

type Mimic = { joint: string; multiplier: number; offset: number };
type JointDefinition = {
  name: string;
  type: string;
  parent: string;
  child: string;
  xyz: [number, number, number];
  rpy: [number, number, number];
  axis: [number, number, number];
  mimic?: Mimic;
};

export type IkResult =
  | { ok: true; joints: JointAngles; positionErrorMm: number; angleErrorDeg: number }
  | { ok: false; joints: JointAngles; positionErrorMm: number; angleErrorDeg: number };

const RAD_LIMITS = JOINT_LIMITS_DEG.map((limit) => ({
  min: rad(limit.min),
  max: rad(limit.max),
}));

const tuple3 = (value: string | null, fallback: [number, number, number]): [number, number, number] => {
  if (!value) return [...fallback];
  const values = value.trim().split(/\s+/).map(Number);
  if (values.length !== 3 || values.some((v) => !Number.isFinite(v))) return [...fallback];
  return values as [number, number, number];
};

function childElement(parent: Element, tag: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) return child;
  }
  return null;
}

function readJoint(element: Element): JointDefinition {
  const parent = childElement(element, "parent")?.getAttribute("link");
  const child = childElement(element, "child")?.getAttribute("link");
  if (!parent || !child) throw new Error("URDF joint is missing a parent or child link.");

  const origin = childElement(element, "origin");
  const axis = childElement(element, "axis");
  const mimicElement = childElement(element, "mimic");
  const mimicJoint = mimicElement?.getAttribute("joint");
  const mimic = mimicJoint
    ? {
        joint: mimicJoint,
        multiplier: Number(mimicElement?.getAttribute("multiplier") ?? "1"),
        offset: Number(mimicElement?.getAttribute("offset") ?? "0"),
      }
    : undefined;

  return {
    name: element.getAttribute("name") ?? "",
    type: element.getAttribute("type") ?? "fixed",
    parent,
    child,
    xyz: tuple3(origin?.getAttribute("xyz") ?? null, [0, 0, 0]),
    rpy: tuple3(origin?.getAttribute("rpy") ?? null, [0, 0, 0]),
    axis: tuple3(axis?.getAttribute("xyz") ?? null, [1, 0, 0]),
    mimic,
  };
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] | null {
  const size = values.length;
  const a = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    if (Math.abs(a[pivot][column]) < 1e-12) return null;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    for (let j = column; j <= size; j += 1) a[column][j] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let j = column; j <= size; j += 1) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map((row) => row[size]);
}

const shortestAngle = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

function positionMatrix(definition: JointDefinition): Matrix4 {
  const position = new Vector3(...definition.xyz).multiplyScalar(1000);
  const orientation = new Quaternion().setFromEuler(
    new Euler(definition.rpy[0], definition.rpy[1], definition.rpy[2], "ZYX"),
  );
  return new Matrix4().compose(position, orientation, new Vector3(1, 1, 1));
}

function rotationMatrix(definition: JointDefinition, angle: number): Matrix4 {
  const axis = new Vector3(...definition.axis).normalize();
  return new Matrix4().makeRotationAxis(axis, angle);
}

export class MG400Kinematics {
  private readonly joints: JointDefinition[];
  private readonly definitionsByName: Map<string, JointDefinition>;

  private constructor(joints: JointDefinition[]) {
    this.joints = joints;
    this.definitionsByName = new Map(joints.map((joint) => [joint.name, joint]));
  }

  static fromUrdf(xml: string): MG400Kinematics {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) throw new Error("The MG400 URDF could not be parsed.");
    const joints = Array.from(document.querySelectorAll("robot > joint")).map(readJoint);
    if (!joints.some((joint) => joint.name === "j1") || !joints.some((joint) => joint.name === "j4")) {
      throw new Error("The loaded URDF is missing the MG400 motion joints.");
    }
    return new MG400Kinematics(joints);
  }

  private jointValues(commanded: JointAngles): Map<string, number> {
    const values = new Map<string, number>([
      ["j1", commanded[0]],
      ["j2", commanded[1]],
      ["j3", commanded[2]],
      ["j4", commanded[3]],
    ]);
    const resolve = (name: string, visiting = new Set<string>()): number => {
      if (values.has(name)) return values.get(name)!;
      const definition = this.definitionsByName.get(name);
      if (!definition?.mimic) return 0;
      if (visiting.has(name)) throw new Error("The URDF contains a mimic-joint cycle.");
      visiting.add(name);
      const value =
        resolve(definition.mimic.joint, visiting) * definition.mimic.multiplier +
        definition.mimic.offset;
      visiting.delete(name);
      values.set(name, value);
      return value;
    };
    for (const definition of this.joints) resolve(definition.name);
    return values;
  }

  linkMatrices(commanded: JointAngles): Map<string, Matrix4> {
    const values = this.jointValues(commanded);
    const transforms = new Map<string, Matrix4>([["base_link", new Matrix4()]]);
    const pending = [...this.joints];

    while (pending.length > 0) {
      let progressed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const definition = pending[index];
        const parent = transforms.get(definition.parent);
        if (!parent) continue;
        const local = positionMatrix(definition);
        if (definition.type !== "fixed") {
          local.multiply(rotationMatrix(definition, values.get(definition.name) ?? 0));
        }
        transforms.set(definition.child, parent.clone().multiply(local));
        pending.splice(index, 1);
        progressed = true;
      }
      if (!progressed) {
        throw new Error("The MG400 URDF has a disconnected or cyclic link tree.");
      }
    }
    return transforms;
  }

  flangeMatrix(joints: JointAngles, flangeOffset: Pose): Matrix4 {
    const link5 = this.linkMatrices(joints).get("link5");
    if (!link5) throw new Error("The MG400 URDF has no link5 flange frame.");
    const offset = new Matrix4().makeTranslation(flangeOffset.x, flangeOffset.y, flangeOffset.z);
    const rotation = new Matrix4().makeRotationZ(rad(flangeOffset.r));
    return link5.clone().multiply(offset).multiply(rotation);
  }

  forward(joints: JointAngles, flangeOffset: Pose, tcpOffset: Pose): Pose {
    const link5 = this.linkMatrices(joints).get("link5");
    if (!link5) throw new Error("The MG400 URDF has no link5 flange frame.");
    const flangePosition = new Vector3(flangeOffset.x, flangeOffset.y, flangeOffset.z);
    const tcpPosition = new Vector3(tcpOffset.x, tcpOffset.y, tcpOffset.z);
    const local = flangePosition.add(tcpPosition.applyMatrix4(new Matrix4().makeRotationZ(rad(flangeOffset.r))));
    const world = local.applyMatrix4(link5);
    const xAxis = new Vector3(1, 0, 0).transformDirection(link5);
    return {
      x: world.x,
      y: world.y,
      z: world.z,
      r: deg(Math.atan2(xAxis.y, xAxis.x)) + flangeOffset.r + tcpOffset.r,
    };
  }

  solve(
    target: Pose,
    seed: JointAngles,
    flangeOffset: Pose,
    tcpOffset: Pose,
    positionToleranceMm = 0.5,
  ): IkResult {
    const base = Math.atan2(target.y, target.x);
    const seeds: JointAngles[] = [
      [...seed] as JointAngles,
      [base, rad(30), rad(45), rad(target.r) - base],
      [base, rad(65), rad(70), rad(target.r) - base],
      [base, rad(-10), rad(80), rad(target.r) - base],
    ];
    let best: IkResult = {
      ok: false,
      joints: [...seed],
      positionErrorMm: Number.POSITIVE_INFINITY,
      angleErrorDeg: Number.POSITIVE_INFINITY,
    };

    for (const candidate of seeds) {
      const result = this.solveFromSeed(target, candidate, flangeOffset, tcpOffset, positionToleranceMm);
      if (result.positionErrorMm + result.angleErrorDeg < best.positionErrorMm + best.angleErrorDeg) {
        best = result;
      }
      if (result.ok) return result;
    }
    return best;
  }

  private solveFromSeed(
    target: Pose,
    seed: JointAngles,
    flangeOffset: Pose,
    tcpOffset: Pose,
    toleranceMm: number,
  ): IkResult {
    const joints = seed.map((value, index) =>
      Math.max(RAD_LIMITS[index].min, Math.min(RAD_LIMITS[index].max, value)),
    ) as JointAngles;
    const orientationWeight = 100;
    const toleranceDeg = 0.1;

    for (let iteration = 0; iteration < 90; iteration += 1) {
      const pose = this.forward(joints, flangeOffset, tcpOffset);
      const error = [
        target.x - pose.x,
        target.y - pose.y,
        target.z - pose.z,
        shortestAngle(rad(pose.r), rad(target.r)) * orientationWeight,
      ];
      const positionErrorMm = Math.hypot(error[0], error[1], error[2]);
      const angleErrorDeg = Math.abs(deg(error[3] / orientationWeight));
      if (positionErrorMm <= toleranceMm && angleErrorDeg <= toleranceDeg) {
        return { ok: true, joints, positionErrorMm, angleErrorDeg };
      }

      const jacobian = Array.from({ length: 4 }, () => Array(4).fill(0));
      const step = 0.0001;
      for (let column = 0; column < 4; column += 1) {
        const perturbed = [...joints] as JointAngles;
        perturbed[column] += step;
        const next = this.forward(perturbed, flangeOffset, tcpOffset);
        jacobian[0][column] = (next.x - pose.x) / step;
        jacobian[1][column] = (next.y - pose.y) / step;
        jacobian[2][column] = (next.z - pose.z) / step;
        jacobian[3][column] =
          (shortestAngle(rad(pose.r), rad(next.r)) * orientationWeight) / step;
      }

      const normal = Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, column) => {
          let sum = 0;
          for (let index = 0; index < 4; index += 1) {
            sum += jacobian[index][row] * jacobian[index][column];
          }
          return sum + (row === column ? 0.01 : 0);
        }),
      );
      const projected = Array.from({ length: 4 }, (_, column) => {
        let sum = 0;
        for (let row = 0; row < 4; row += 1) sum += jacobian[row][column] * error[row];
        return sum;
      });
      const delta = solveLinearSystem(normal, projected);
      if (!delta) break;
      for (let index = 0; index < 4; index += 1) {
        const boundedStep = Math.max(-0.18, Math.min(0.18, delta[index]));
        joints[index] = Math.max(
          RAD_LIMITS[index].min,
          Math.min(RAD_LIMITS[index].max, joints[index] + boundedStep),
        );
      }
    }

    const finalPose = this.forward(joints, flangeOffset, tcpOffset);
    return {
      ok: false,
      joints,
      positionErrorMm: Math.hypot(
        target.x - finalPose.x,
        target.y - finalPose.y,
        target.z - finalPose.z,
      ),
      angleErrorDeg: Math.abs(deg(shortestAngle(rad(finalPose.r), rad(target.r)))),
    };
  }
}
