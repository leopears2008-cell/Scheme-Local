/**
 * DEMO MODE (hackathon). Clearly labelled, synthetic data only, never bypasses real sign-in or the backend.
 * When enabled the app shows a banner. No real citizen data is used or created here.
 */
export const DEMO_ENABLED = (import.meta.env.VITE_DEMO_MODE as string) === "true";

export const DEMO_PROFILE = {
  age: "34", gender: "female", occupation: "farmer", annualIncome: "150000", state: "Tamil Nadu",
  category: "BC", landHectares: "1.2", // 'BC' = Backward Class (community category), not an income category
};

/** Offline demo path: Find and Check run without a live AI provider. The sample is labelled as synthetic. */
export const DEMO_NOTE = "SAMPLE PROFILE (synthetic, not a real person). Eligibility checks are indicative only.";
