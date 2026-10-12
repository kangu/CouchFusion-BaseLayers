/**
 * Path exclusion matcher: exact paths or `*`-suffixed prefixes.
 */
export const createExclusionMatcher = (patterns: string[]) => {
  const normalized = patterns.map((pattern) => pattern.trim()).filter(Boolean);
  if (normalized.length === 0) return () => false;
  return (path: string) =>
    normalized.some((pattern) =>
      pattern.endsWith("*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern,
    );
};
