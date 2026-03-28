interface ResolveLoginRedirectTargetInput {
  redirectTo: string | null | undefined;
  defaultTarget: string | null | undefined;
}

export const resolveLoginRedirectTarget = ({
  redirectTo,
  defaultTarget,
}: ResolveLoginRedirectTargetInput): string => {
  const redirectTarget = String(redirectTo ?? "").trim();
  if (redirectTarget.length > 0) {
    return redirectTarget;
  }

  const configuredDefaultTarget = String(defaultTarget ?? "").trim();
  if (configuredDefaultTarget.length > 0) {
    return configuredDefaultTarget;
  }

  return "/builder";
};
