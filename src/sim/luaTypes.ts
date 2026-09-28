import type { JointAngles, Pose } from "../domain";

export type MotionCommand = "MovJ" | "MovL" | "JointMovJ" | "RelMovL";

export type MotionRequest = {
  commandId: number;
  command: MotionCommand;
  targetPose?: Pose;
  relativeOffset?: Pose;
  targetJoints?: JointAngles;
  speed: number;
  acceleration: number;
  sync: boolean;
};

export type LuaWorkerMessage =
  | { type: "motion"; motion: MotionRequest }
  | { type: "io"; index: number; value: boolean }
  | { type: "tool"; action: "pick" | "place" }
  | { type: "clock"; mode: "sleep" | "wait" | "sync"; milliseconds: number; requestId: number }
  | { type: "state"; state: "pose" | "angles"; requestId: number }
  | { type: "rpc-response"; requestId: number; value: unknown }
  | { type: "motion-complete"; commandId: number }
  | { type: "motion-failed"; commandId: number; message: string }
  | { type: "print"; message: string; level: "info" | "warning" | "error" }
  | { type: "script-complete" }
  | { type: "script-error"; message: string };
