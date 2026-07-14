import { describe, expect, it } from "vitest";
import {
    deserializeSaveBarPosition,
    serializeSaveBarPosition,
} from "../../app/utils/save-bar-position";

describe("save bar position storage", () => {
    it("restores a proportional position within new iframe bounds", () => {
        const saved = serializeSaveBarPosition(
            { left: 300, top: 150 },
            { minLeft: 0, maxLeft: 600, minTop: 0, maxTop: 300 },
        );

        expect(
            deserializeSaveBarPosition(saved, {
                minLeft: 0,
                maxLeft: 300,
                minTop: 0,
                maxTop: 600,
            }),
        ).toEqual({ left: 150, top: 300 });
    });
});
