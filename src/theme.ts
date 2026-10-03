export type WorkspaceTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mg400-workspace-theme";

/** Read once at startup: a deliberate choice takes precedence over the OS. */
export function readWorkspaceTheme(): WorkspaceTheme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** A storage failure must not prevent the in-memory theme from changing. */
export function saveWorkspaceTheme(theme: WorkspaceTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current session can still use the chosen theme.
  }
}
