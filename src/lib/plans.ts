const DISPLAY_PLAN_NAMES: Record<string, string> = {
  BASIC: "Basic",
  PREMIUM: "Pro",
  FULL: "Premium",
};

export const getDisplayPlanName = (planCode?: string | null, fallbackPlanName?: string | null) => {
  const normalizedPlanCode = planCode?.trim().toUpperCase() ?? "";

  if (normalizedPlanCode && DISPLAY_PLAN_NAMES[normalizedPlanCode]) {
    return DISPLAY_PLAN_NAMES[normalizedPlanCode];
  }

  const normalizedPlanName = fallbackPlanName?.trim().toLowerCase() ?? "";

  switch (normalizedPlanName) {
    case "basic":
    case "starter":
      return "Basic";
    case "pro":
      return "Pro";
    case "full":
    case "premium":
      return "Premium";
    default:
      return fallbackPlanName?.trim() ?? normalizedPlanCode;
  }
};
