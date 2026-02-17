"use client";

import type { CSSProperties, RefObject, TouchEventHandler } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { triggerHaptic } from "@/src/lib/utils/haptics";

type PullToRefreshStatus =
  | "idle"
  | "pulling"
  | "ready"
  | "refreshing"
  | "success";

type UsePullToRefreshOptions = {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<unknown> | unknown;
  threshold?: number;
  holdDistance?: number;
  maxPullDistance?: number;
  successDurationMs?: number;
  disabled?: boolean;
};

type UsePullToRefreshResult = {
  status: PullToRefreshStatus;
  pullDistance: number;
  progress: number;
  isRefreshing: boolean;
  isThresholdReached: boolean;
  containerStyle: CSSProperties;
  handleTouchStart: TouchEventHandler<HTMLElement>;
  handleTouchMove: TouchEventHandler<HTMLElement>;
  handleTouchEnd: TouchEventHandler<HTMLElement>;
  handleTouchCancel: TouchEventHandler<HTMLElement>;
};

const AXIS_LOCK_THRESHOLD = 6;

function applyRubberBand(distance: number, maxPullDistance: number) {
  if (distance <= 0) {
    return 0;
  }

  return maxPullDistance * (1 - Math.exp(-distance / (maxPullDistance * 0.6)));
}

export function usePullToRefresh({
  scrollRef,
  onRefresh,
  threshold = 80,
  holdDistance = 56,
  maxPullDistance = 160,
  successDurationMs = 500,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [status, setStatus] = useState<PullToRefreshStatus>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const [isTouchTracking, setIsTouchTracking] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const axisRef = useRef<"x" | "y" | null>(null);
  const thresholdHapticTriggeredRef = useRef(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingVisualRef = useRef<{
    pullDistance: number;
    status: PullToRefreshStatus;
  } | null>(null);
  const pullDistanceRef = useRef(0);
  const statusRef = useRef<PullToRefreshStatus>("idle");

  const progress = useMemo(
    () => Math.max(0, Math.min(1, pullDistance / threshold)),
    [pullDistance, threshold],
  );

  const resetToIdle = useCallback(() => {
    statusRef.current = "idle";
    pullDistanceRef.current = 0;
    setStatus("idle");
    setPullDistance(0);
    thresholdHapticTriggeredRef.current = false;
  }, []);

  const flushVisualState = useCallback(() => {
    frameRef.current = null;
    const pending = pendingVisualRef.current;
    if (!pending) {
      return;
    }
    pendingVisualRef.current = null;
    pullDistanceRef.current = pending.pullDistance;
    statusRef.current = pending.status;
    setPullDistance((previous) =>
      previous === pending.pullDistance ? previous : pending.pullDistance,
    );
    setStatus((previous) =>
      previous === pending.status ? previous : pending.status,
    );
  }, []);

  const queueVisualState = useCallback(
    (nextDistance: number, nextStatus: PullToRefreshStatus) => {
      pendingVisualRef.current = {
        pullDistance: nextDistance,
        status: nextStatus,
      };
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(flushVisualState);
    },
    [flushVisualState],
  );

  const completeRefresh = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    statusRef.current = "success";
    setStatus("success");
    triggerHaptic(200, [80, 40, 80]);

    successTimeoutRef.current = setTimeout(() => {
      resetToIdle();
    }, successDurationMs);
  }, [resetToIdle, successDurationMs]);

  const runRefresh = useCallback(async () => {
    statusRef.current = "refreshing";
    pullDistanceRef.current = holdDistance;
    setStatus("refreshing");
    setPullDistance(holdDistance);

    try {
      await onRefresh();
    } finally {
      completeRefresh();
    }
  }, [completeRefresh, holdDistance, onRefresh]);

  const handleTouchStart = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (
        disabled ||
        statusRef.current === "refreshing" ||
        event.touches.length !== 1
      ) {
        return;
      }

      const scrollElement = scrollRef.current;
      if (!scrollElement || scrollElement.scrollTop > 0) {
        return;
      }

      const touch = event.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      axisRef.current = null;
      thresholdHapticTriggeredRef.current = false;
      setIsTouchTracking(true);
    },
    [disabled, scrollRef],
  );

  const handleTouchMove = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (!isTouchTracking || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);

      if (
        !axisRef.current &&
        (absY > AXIS_LOCK_THRESHOLD || absX > AXIS_LOCK_THRESHOLD)
      ) {
        axisRef.current = absY >= absX ? "y" : "x";
      }

      if (axisRef.current === "x") {
        return;
      }

      const scrollElement = scrollRef.current;
      if (!scrollElement) {
        return;
      }

      if (deltaY <= 0) {
        queueVisualState(0, "idle");
        thresholdHapticTriggeredRef.current = false;
        return;
      }

      if (scrollElement.scrollTop > 0 && pullDistanceRef.current <= 0) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const resisted = applyRubberBand(deltaY, maxPullDistance);
      const nextStatus = resisted >= threshold ? "ready" : "pulling";

      queueVisualState(resisted, nextStatus);

      if (resisted >= threshold && !thresholdHapticTriggeredRef.current) {
        thresholdHapticTriggeredRef.current = true;
        triggerHaptic(100);
      } else if (resisted < threshold) {
        thresholdHapticTriggeredRef.current = false;
      }
    },
    [isTouchTracking, maxPullDistance, queueVisualState, scrollRef, threshold],
  );

  const handleTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(() => {
    if (!isTouchTracking) {
      return;
    }

    setIsTouchTracking(false);
    axisRef.current = null;

    if (statusRef.current === "ready" && pullDistanceRef.current >= threshold) {
      void runRefresh();
      return;
    }

    resetToIdle();
  }, [isTouchTracking, resetToIdle, runRefresh, threshold]);

  const handleTouchCancel = useCallback<TouchEventHandler<HTMLElement>>(() => {
    if (!isTouchTracking) {
      return;
    }

    setIsTouchTracking(false);
    axisRef.current = null;
    resetToIdle();
  }, [isTouchTracking, resetToIdle]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    },
    [],
  );

  const containerStyle = useMemo<CSSProperties>(() => {
    const shouldHold = status === "refreshing" || status === "success";
    const offset = shouldHold
      ? Math.max(pullDistance, holdDistance)
      : pullDistance;

    return {
      transform: `translate3d(0, ${offset}px, 0)`,
      transition:
        isTouchTracking && (status === "pulling" || status === "ready")
          ? "none"
          : "transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1)",
      willChange: "transform",
    };
  }, [holdDistance, isTouchTracking, pullDistance, status]);

  return {
    status,
    pullDistance,
    progress,
    isRefreshing: status === "refreshing",
    isThresholdReached:
      status === "ready" || status === "refreshing" || status === "success",
    containerStyle,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
