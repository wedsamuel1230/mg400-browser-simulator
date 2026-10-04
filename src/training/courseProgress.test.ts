import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../projectStore";
import {
  COURSE_PROGRESS_STORAGE_KEY,
  createEmptyCourseProgress,
  loadCourseProgress,
  saveCourseProgress,
  validateCourseProgress,
} from "./courseProgress";

describe("course progress", () => {
  afterEach(() => localStorage.clear());

  it("persists only validated lesson progress and keeps it separate from robot projects", () => {
    const progress = {
      ...createEmptyCourseProgress(),
      language: "zh-Hant" as const,
      completedLessonIds: ["foundation-cell-and-coordinates"],
    };
    expect(saveCourseProgress(progress)).toBe(true);
    expect(loadCourseProgress()).toEqual(progress);
    expect(COURSE_PROGRESS_STORAGE_KEY).not.toBe(STORAGE_KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops unknown lesson ids, malformed attempts, and duplicate completions", () => {
    const result = validateCourseProgress({
      schemaVersion: 1,
      language: "en",
      completedLessonIds: ["foundation-cell-and-coordinates", "foundation-cell-and-coordinates", "unknown"],
      attemptsByLesson: { "foundation-cell-and-coordinates": 2, unknown: 5, "intermediate-pick-and-place": -1 },
    });
    expect(result.completedLessonIds).toEqual(["foundation-cell-and-coordinates"]);
    expect(result.attemptsByLesson).toEqual({ "foundation-cell-and-coordinates": 2 });
  });

  it("recovers invalid JSON storage to fresh progress", () => {
    localStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, "{");
    expect(loadCourseProgress()).toEqual(createEmptyCourseProgress());
  });

  it("starts fresh learners at the first-code lesson and preserves valid progress from the previous curriculum version", () => {
    expect(createEmptyCourseProgress().lastLessonId).toBe("foundation-first-program");
    const previous = validateCourseProgress({
      schemaVersion: 1,
      curriculumVersion: "1.2.0",
      language: "zh-Hant",
      completedLessonIds: ["foundation-cell-and-coordinates"],
      attemptsByLesson: { "foundation-cell-and-coordinates": 1 },
      lastLessonId: "foundation-lua-decisions-and-loops",
    });
    expect(previous.curriculumVersion).toBe("1.3.6");
    expect(previous.lastLessonId).toBe("foundation-if-else");
    expect(previous.completedLessonIds).toEqual(["foundation-cell-and-coordinates"]);
    expect(previous.attemptsByLesson).toEqual({ "foundation-cell-and-coordinates": 1 });
  });

  it("migrates completion of the former combined control-flow lesson to both short lessons", () => {
    const migrated = validateCourseProgress({
      schemaVersion: 1,
      curriculumVersion: "1.3.1",
      language: "en",
      completedLessonIds: ["foundation-lua-decisions-and-loops"],
      attemptsByLesson: { "foundation-lua-decisions-and-loops": 2 },
      lastLessonId: "foundation-lua-decisions-and-loops",
    });

    expect(migrated.curriculumVersion).toBe("1.3.6");
    expect(migrated.completedLessonIds).toEqual(["foundation-if-else", "foundation-loops"]);
    expect(migrated.attemptsByLesson).toEqual({ "foundation-if-else": 2, "foundation-loops": 2 });
    expect(migrated.lastLessonId).toBe("foundation-loops");
  });

  it("resumes an incomplete former combined lesson at its first short lesson", () => {
    const migrated = validateCourseProgress({
      schemaVersion: 1,
      curriculumVersion: "1.3.1",
      language: "zh-Hant",
      completedLessonIds: [],
      attemptsByLesson: { "foundation-lua-decisions-and-loops": 1 },
      lastLessonId: "foundation-lua-decisions-and-loops",
    });

    expect(migrated.completedLessonIds).toEqual([]);
    expect(migrated.attemptsByLesson).toEqual({ "foundation-if-else": 1, "foundation-loops": 1 });
    expect(migrated.lastLessonId).toBe("foundation-if-else");
  });
});
