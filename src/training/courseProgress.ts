import { CURRICULUM_VERSION, LESSON_BY_ID, type CourseLanguage } from "./curriculum";

export const COURSE_PROGRESS_STORAGE_KEY = "mg400-course-progress-v1";
const LEGACY_CONTROL_FLOW_LESSON_ID = "foundation-lua-decisions-and-loops";
const IF_ELSE_LESSON_ID = "foundation-if-else";
const LOOPS_LESSON_ID = "foundation-loops";

export type CourseProgress = {
  schemaVersion: 1;
  curriculumVersion: string;
  language: CourseLanguage;
  completedLessonIds: string[];
  attemptsByLesson: Record<string, number>;
  lastLessonId: string;
};

export function createEmptyCourseProgress(): CourseProgress {
  return {
    schemaVersion: 1,
    curriculumVersion: CURRICULUM_VERSION,
    language: "zh-Hant",
    completedLessonIds: [],
    attemptsByLesson: {},
    lastLessonId: "foundation-first-program",
  };
}

export function validateCourseProgress(value: unknown): CourseProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return createEmptyCourseProgress();
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || (data.language !== "en" && data.language !== "zh-Hant")) return createEmptyCourseProgress();

  const savedCompletedIds = Array.isArray(data.completedLessonIds)
    ? data.completedLessonIds.filter((id): id is string => typeof id === "string")
    : [];
  const legacyControlFlowCompleted = savedCompletedIds.includes(LEGACY_CONTROL_FLOW_LESSON_ID);
  const completedLessonIds = [...new Set([
    ...savedCompletedIds.filter((id) => LESSON_BY_ID.has(id)),
    ...(legacyControlFlowCompleted ? [IF_ELSE_LESSON_ID, LOOPS_LESSON_ID] : []),
  ])];
  const attemptsByLesson: Record<string, number> = {};
  if (typeof data.attemptsByLesson === "object" && data.attemptsByLesson !== null && !Array.isArray(data.attemptsByLesson)) {
    for (const [id, count] of Object.entries(data.attemptsByLesson)) {
      if (id !== LEGACY_CONTROL_FLOW_LESSON_ID && LESSON_BY_ID.has(id) && typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 100_000) {
        attemptsByLesson[id] = count;
      }
    }
    const legacyAttempts = (data.attemptsByLesson as Record<string, unknown>)[LEGACY_CONTROL_FLOW_LESSON_ID];
    if (typeof legacyAttempts === "number" && Number.isInteger(legacyAttempts) && legacyAttempts >= 0 && legacyAttempts <= 100_000) {
      attemptsByLesson[IF_ELSE_LESSON_ID] ??= legacyAttempts;
      attemptsByLesson[LOOPS_LESSON_ID] ??= legacyAttempts;
    }
  }

  const savedLastLessonId = typeof data.lastLessonId === "string" ? data.lastLessonId : undefined;
  const migratedLastLessonId = savedLastLessonId === LEGACY_CONTROL_FLOW_LESSON_ID
    ? legacyControlFlowCompleted ? LOOPS_LESSON_ID : IF_ELSE_LESSON_ID
    : savedLastLessonId;

  return {
    schemaVersion: 1,
    curriculumVersion: CURRICULUM_VERSION,
    language: data.language,
    completedLessonIds,
    attemptsByLesson,
    lastLessonId: migratedLastLessonId && LESSON_BY_ID.has(migratedLastLessonId)
      ? migratedLastLessonId
      : "foundation-first-program",
  };
}

export function loadCourseProgress(): CourseProgress {
  try {
    const raw = window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);
    return raw ? validateCourseProgress(JSON.parse(raw)) : createEmptyCourseProgress();
  } catch {
    return createEmptyCourseProgress();
  }
}

export function saveCourseProgress(progress: CourseProgress): boolean {
  try {
    window.localStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(validateCourseProgress(progress)));
    return true;
  } catch {
    return false;
  }
}
