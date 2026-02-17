"use client";

import type { RefObject, TouchEventHandler } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateSwipeProgress,
  shouldExecuteAction,
  triggerHaptic,
} from "@/src/lib/utils/haptics";

type SwipeDirection = "right" | "left" | null;
type SwipeAction = "PAID" | "CANCELLED" | null;

type SwipeReleaseResult = {
  action: SwipeAction;
  direction: SwipeDirection;
  executed: boolean;
  progress: number;
  velocityX: number;
};

type UseSwipeGestureOptions = {
  cardRef: RefObject<HTMLElement | null>;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onRelease?: (result: SwipeReleaseResult) => void;
  onRequestLock?: () => boolean;
  onReleaseLock?: () => void;
  disabled?: boolean;
  canSwipeRight?: boolean;
  canSwipeLeft?: boolean;
  previewThreshold?: number;
  threshold?: number;
  velocityThreshold?: number;
  axisLockThreshold?: number;
  maxOverswipeRatio?: number;
};

export function useSwipeGesture({
  cardRef,
  onSwipeRight,
  onSwipeLeft,
  onRelease,
  onRequestLock,
  onReleaseLock,
  disabled = false,
  canSwipeRight = true,
  canSwipeLeft = true,
  previewThreshold = 0.3,
  threshold = 0.8,
  velocityThreshold = 1.0, // 1px/ms = 1000px/s
  axisLockThreshold = 8,
  maxOverswipeRatio = 1.1,
}: UseSwipeGestureOptions) {
  const [deltaX, setDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const cardWidthRef = useRef(1);
  const axisLockRef = useRef<"x" | "y" | null>(null);
  const lockOwnedRef = useRef(false);
  const executeHapticRef = useRef(false);
  const latestXRef = useRef(0);
  const latestTimeRef = useRef(0);
  const deltaXRef = useRef(0);
  const swipeDirectionRef = useRef<SwipeDirection>(null);
  const swipeProgressRef = useRef(0);
  const hasMovedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingVisualRef = useRef<{
    deltaX: number;
    swipeProgress: number;
    swipeDirection: SwipeDirection;
    hasMoved: boolean;
  } | null>(null);

  const flushVisualState = useCallback(() => {
    frameRef.current = null;
    const pending = pendingVisualRef.current;
    if (!pending) {
      return;
    }
    pendingVisualRef.current = null;
    setDeltaX((previous) =>
      previous === pending.deltaX ? previous : pending.deltaX,
    );
    setSwipeProgress((previous) =>
      previous === pending.swipeProgress ? previous : pending.swipeProgress,
    );
    setSwipeDirection((previous) =>
      previous === pending.swipeDirection ? previous : pending.swipeDirection,
    );
    if (pending.hasMoved) {
      setHasMoved(true);
    }
  }, []);

  const queueVisualState = useCallback(
    (next: {
      deltaX: number;
      swipeProgress: number;
      swipeDirection: SwipeDirection;
      hasMoved: boolean;
    }) => {
      pendingVisualRef.current = next;
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(flushVisualState);
    },
    [flushVisualState],
  );

  const resetGesture = useCallback(() => {
    deltaXRef.current = 0;
    swipeDirectionRef.current = null;
    swipeProgressRef.current = 0;
    hasMovedRef.current = false;
    pendingVisualRef.current = null;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setDeltaX(0);
    setSwipeDirection(null);
    setSwipeProgress(0);
    setHasMoved(false);
    axisLockRef.current = null;
    executeHapticRef.current = false;
  }, []);

  const finishGesture = useCallback(
    (executed: boolean, velocityX: number) => {
      const latestDeltaX = deltaXRef.current;
      const progress = calculateSwipeProgress(
        latestDeltaX,
        cardWidthRef.current,
      );
      const direction: SwipeDirection =
        latestDeltaX > 0 ? "right" : latestDeltaX < 0 ? "left" : null;
      const action: SwipeAction =
        direction === "right"
          ? "PAID"
          : direction === "left"
            ? "CANCELLED"
            : null;

      onRelease?.({
        action,
        direction,
        executed,
        progress,
        velocityX,
      });

      if (executed) {
        if (direction === "right") {
          onSwipeRight?.();
        } else if (direction === "left") {
          onSwipeLeft?.();
        }
      } else {
        resetGesture();
      }

      if (lockOwnedRef.current) {
        onReleaseLock?.();
      }
      lockOwnedRef.current = false;
      setIsDragging(false);
    },
    [onRelease, onReleaseLock, onSwipeLeft, onSwipeRight, resetGesture],
  );

  const handleTouchStart = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || event.touches.length !== 1) {
        return;
      }

      const lockGranted = onRequestLock?.() ?? true;
      if (!lockGranted) {
        return;
      }

      const touch = event.touches[0];
      const width = cardRef.current?.getBoundingClientRect().width ?? 1;

      lockOwnedRef.current = true;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      latestXRef.current = touch.clientX;
      startTimeRef.current = performance.now();
      latestTimeRef.current = startTimeRef.current;
      cardWidthRef.current = width;
      axisLockRef.current = null;
      executeHapticRef.current = false;
      deltaXRef.current = 0;
      swipeProgressRef.current = 0;
      swipeDirectionRef.current = null;
      hasMovedRef.current = false;
      setDeltaX(0);
      setSwipeProgress(0);
      setSwipeDirection(null);
      setHasMoved(false);
      setIsDragging(true);

      // iOS/Android only vibrate in user-driven handlers.
      triggerHaptic(50);
    },
    [cardRef, disabled, onRequestLock],
  );

  const handleTouchMove = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (!isDragging || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const rawDeltaX = touch.clientX - startXRef.current;
      const rawDeltaY = touch.clientY - startYRef.current;

      if (!axisLockRef.current) {
        const absX = Math.abs(rawDeltaX);
        const absY = Math.abs(rawDeltaY);

        if (absX > axisLockThreshold || absY > axisLockThreshold) {
          axisLockRef.current = absX >= absY ? "x" : "y";
        }
      }

      if (axisLockRef.current === "y") {
        return;
      }

      // Prevent scroll only when horizontal gesture is active
      if (event.cancelable) {
        event.preventDefault();
      }

      let nextDeltaX = rawDeltaX;
      if (nextDeltaX > 0 && !canSwipeRight) {
        nextDeltaX = 0;
      }
      if (nextDeltaX < 0 && !canSwipeLeft) {
        nextDeltaX = 0;
      }

      // Rubber-banding effect: move less the further we go
      const limit = cardWidthRef.current;
      if (Math.abs(nextDeltaX) > limit) {
        const overflow = Math.abs(nextDeltaX) - limit;
        const maxSwipeDistance = limit * maxOverswipeRatio;
        const rubberBanded = Math.min(
          limit + overflow * 0.25,
          maxSwipeDistance,
        );
        nextDeltaX = nextDeltaX > 0 ? rubberBanded : -rubberBanded;
      }

      const progress = calculateSwipeProgress(nextDeltaX, cardWidthRef.current);
      const direction: SwipeDirection =
        nextDeltaX > 0 ? "right" : nextDeltaX < 0 ? "left" : null;

      if (Math.abs(nextDeltaX) > 6) {
        hasMovedRef.current = true;
      }

      latestXRef.current = touch.clientX;
      latestTimeRef.current = performance.now();
      deltaXRef.current = nextDeltaX;
      swipeProgressRef.current = progress;
      swipeDirectionRef.current = direction;
      queueVisualState({
        deltaX: nextDeltaX,
        swipeProgress: progress,
        swipeDirection: direction,
        hasMoved: hasMovedRef.current,
      });

      const crossedThreshold = shouldExecuteAction(progress, threshold);

      if (!executeHapticRef.current && crossedThreshold && direction) {
        executeHapticRef.current = true;
        triggerHaptic(100, [100, 40, 100]);
      } else if (!crossedThreshold && executeHapticRef.current) {
        // Reset haptic ref if user pulls back below threshold
        executeHapticRef.current = false;
      }
    },
    [
      axisLockThreshold,
      canSwipeLeft,
      canSwipeRight,
      isDragging,
      maxOverswipeRatio,
      queueVisualState,
      threshold,
    ],
  );

  const handleTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(() => {
    if (!isDragging) {
      return;
    }

    const elapsedMs = Math.max(1, latestTimeRef.current - startTimeRef.current);
    const velocityX = (latestXRef.current - startXRef.current) / elapsedMs;
    const latestDeltaX = deltaXRef.current;
    const progress = calculateSwipeProgress(latestDeltaX, cardWidthRef.current);

    const direction: SwipeDirection =
      latestDeltaX > 0 ? "right" : latestDeltaX < 0 ? "left" : null;

    const directionAllowed =
      (direction === "right" && canSwipeRight) ||
      (direction === "left" && canSwipeLeft);

    const crossedExecuteThreshold = shouldExecuteAction(progress, threshold);
    const isFastSwipe =
      progress >= previewThreshold && Math.abs(velocityX) >= velocityThreshold;
    const executed = Boolean(
      directionAllowed && (crossedExecuteThreshold || isFastSwipe),
    );

    finishGesture(executed, velocityX);
  }, [
    canSwipeLeft,
    canSwipeRight,
    finishGesture,
    isDragging,
    previewThreshold,
    threshold,
    velocityThreshold,
  ]);

  const handleTouchCancel = useCallback<TouchEventHandler<HTMLElement>>(() => {
    if (!isDragging) {
      return;
    }
    finishGesture(false, 0);
  }, [finishGesture, isDragging]);

  const previewAction = useMemo<SwipeAction>(() => {
    if (swipeProgress < previewThreshold || !swipeDirection) {
      return null;
    }
    return swipeDirection === "right" ? "PAID" : "CANCELLED";
  }, [previewThreshold, swipeDirection, swipeProgress]);

  const isExecuteThresholdReached =
    swipeDirection !== null && shouldExecuteAction(swipeProgress, threshold);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    deltaX,
    swipeProgress,
    swipeDirection,
    previewAction,
    isExecuteThresholdReached,
    isDragging,
    hasMoved,
    resetGesture,
  };
}
