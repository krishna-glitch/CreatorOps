"use client";

import { useCallback, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { triggerHaptic } from "@/src/lib/utils/haptics";

interface LongPressOptions {
    threshold?: number;
    onLongPress: (e: TouchEvent) => void;
    onCancel?: () => void;
    onStart?: () => void;
    onFinish?: () => void;
    onLongPressTriggered?: () => void;
    disabled?: boolean;
}

export function useLongPress({
    threshold = 750,
    onLongPress,
    onCancel,
    onStart,
    onFinish,
    onLongPressTriggered,
    disabled = false,
}: LongPressOptions) {
    const [isLongPressing, setIsLongPressing] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const isTriggeredRef = useRef(false);

    const start = useCallback(
        (e: TouchEvent) => {
            if (disabled) {
                return;
            }
            // Only handle single touch
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            startPosRef.current = { x: touch.clientX, y: touch.clientY };
            isTriggeredRef.current = false;
            onStart?.();

            // Persist event if needed (React 16 behavior, but good hygiene)
            // e.persist(); 

            timerRef.current = setTimeout(() => {
                triggerHaptic(100);
                onLongPress(e);
                isTriggeredRef.current = true;
                setIsLongPressing(true);
                onLongPressTriggered?.();
            }, threshold);
        },
        [disabled, onLongPress, onLongPressTriggered, onStart, threshold],
    );

    const clear = useCallback(
        (shouldTriggerCancel = true) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (shouldTriggerCancel && !isTriggeredRef.current) {
                onCancel?.();
            }
            setIsLongPressing(false);
            startPosRef.current = null;
            onFinish?.();
        },
        [onCancel, onFinish],
    );

    const move = useCallback(
        (e: TouchEvent) => {
            if (!startPosRef.current || !timerRef.current) return;

            const touch = e.touches[0];
            const moveThreshold = 10; // 10px movement tolerance

            const dist = Math.sqrt(
                (touch.clientX - startPosRef.current.x) ** 2 +
                (touch.clientY - startPosRef.current.y) ** 2,
            );

            if (dist > moveThreshold) {
                clear(true);
            }
        },
        [clear],
    );

    return {
        handlers: {
            onTouchStart: start,
            onTouchMove: move,
            onTouchEnd: () => clear(false),
            onTouchCancel: () => clear(true),
        },
        isLongPressing,
    };
}
