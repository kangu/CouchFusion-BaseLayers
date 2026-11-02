import { normalizeGlobalComponentId } from "#content/utils/global-components";
import {
  scanPageComponentUsage,
  type ComponentPageUsage,
} from "./component-usage";

export type GlobalComponentPageUsage = ComponentPageUsage;

/**
 * Find pages that use a global component alias.
 *
 * Delegates to the shared page walker in `component-usage.ts`. Behaviour is unchanged
 * from the original implementation: an exact alias match, including bare text nodes
 * equal to the alias, sorted by path.
 */
export const findGlobalComponentPageUsage = async (
  aliasIdInput: string,
): Promise<GlobalComponentPageUsage[]> => {
  const aliasId = normalizeGlobalComponentId(aliasIdInput);
  if (!aliasId) {
    return [];
  }

  const { pages } = await scanPageComponentUsage([aliasId], {
    matchTextNodes: true,
  });
  return pages;
};
