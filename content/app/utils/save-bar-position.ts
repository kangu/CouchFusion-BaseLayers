export type SaveBarPosition = {
    left: number;
    top: number;
};

export type SaveBarPositionBounds = {
    minLeft: number;
    maxLeft: number;
    minTop: number;
    maxTop: number;
};

export type StoredSaveBarPosition = {
    leftRatio: number;
    topRatio: number;
};

const clampRatio = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Converts an absolute drag point into a viewport-independent stored position. */
export const serializeSaveBarPosition = (
    position: SaveBarPosition,
    bounds: SaveBarPositionBounds,
): StoredSaveBarPosition => {
    const horizontalRange = Math.max(bounds.maxLeft - bounds.minLeft, 0);
    const verticalRange = Math.max(bounds.maxTop - bounds.minTop, 0);

    return {
        leftRatio: horizontalRange
            ? clampRatio((position.left - bounds.minLeft) / horizontalRange)
            : 0,
        topRatio: verticalRange
            ? clampRatio((position.top - bounds.minTop) / verticalRange)
            : 0,
    };
};

/** Resolves a persisted proportional position into the current viewport bounds. */
export const deserializeSaveBarPosition = (
    stored: StoredSaveBarPosition,
    bounds: SaveBarPositionBounds,
): SaveBarPosition => {
    const horizontalRange = Math.max(bounds.maxLeft - bounds.minLeft, 0);
    const verticalRange = Math.max(bounds.maxTop - bounds.minTop, 0);

    return {
        left: bounds.minLeft + horizontalRange * clampRatio(stored.leftRatio),
        top: bounds.minTop + verticalRange * clampRatio(stored.topRatio),
    };
};
