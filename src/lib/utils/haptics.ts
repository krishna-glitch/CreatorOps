export function triggerHaptic(duration: number, pattern?: number[]) {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) {
    return;
  }

  if (pattern && pattern.length > 0) {
    const didVibrate = vibrate(pattern);
    if (!didVibrate) {
      vibrate(duration);
    }
    return;
  }

  vibrate(duration);
}

export function calculateSwipeProgress(delta: number, cardWidth: number) {
  if (cardWidth <= 0) {
    return 0;
  }

  const raw = Math.abs(delta) / cardWidth;
  return Math.max(0, Math.min(1, raw));
}

export function shouldExecuteAction(progress: number, threshold = 0.8) {
  return progress >= threshold;
}
