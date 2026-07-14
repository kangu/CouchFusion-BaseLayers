import type {
  BuilderValue,
  ComponentDefinition,
} from "#content/app/types/builder";

export type PreviewDevice = "desktop" | "mobile";

export const MOBILE_PREVIEW_WIDTH = 375;

export const declaredPreviewDefaults = (
  definition: ComponentDefinition,
): Record<string, BuilderValue> =>
  (definition.props || []).reduce<Record<string, BuilderValue>>(
    (defaults, prop) => {
      if (prop.default !== undefined) {
        defaults[prop.key] = prop.default;
      }
      return defaults;
    },
    {},
  );
