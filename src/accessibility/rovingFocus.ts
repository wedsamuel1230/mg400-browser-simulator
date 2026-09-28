export type RovingFocusOrientation = "horizontal" | "vertical";

export function getRovingFocusIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
  orientation: RovingFocusOrientation,
): number | null {
  if (itemCount <= 0 || currentIndex < 0 || currentIndex >= itemCount) return null;

  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (orientation === "horizontal" && key === "ArrowRight") return (currentIndex + 1) % itemCount;
  if (orientation === "horizontal" && key === "ArrowLeft") return (currentIndex - 1 + itemCount) % itemCount;
  if (orientation === "vertical" && key === "ArrowDown") return (currentIndex + 1) % itemCount;
  if (orientation === "vertical" && key === "ArrowUp") return (currentIndex - 1 + itemCount) % itemCount;
  return null;
}
