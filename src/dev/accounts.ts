/**
 * Dummy applicants for testing in `npm run dev` (never in a build). Their
 * emails are on example.com, which can't receive mail, so anything sent to
 * them goes nowhere. They share the dev-only password in .env.local
 * (VITE_DEV_TEST_PASSWORD) and have no access to anything real.
 */
export type TestAccount = { email: string; name: string; kind: "Hacker" | "Mentor" | "Judge" | "Mentor & judge" };

export const TEST_ACCOUNTS: TestAccount[] = [
  { email: "priya.raman@example.com", name: "Priya Raman", kind: "Hacker" },
  { email: "marcus.lee@example.com", name: "Marcus Lee", kind: "Hacker" },
  { email: "sofia.alvarez@example.com", name: "Sofia Alvarez", kind: "Hacker" },
  { email: "ethan.nguyen@example.com", name: "Ethan Nguyen", kind: "Hacker" },
  { email: "aisha.bello@example.com", name: "Aisha Bello", kind: "Hacker" },
  { email: "daniel.kim@example.com", name: "Daniel Kim", kind: "Hacker" },
  { email: "grace.okafor@example.com", name: "Grace Okafor", kind: "Hacker" },
  { email: "lucas.moreau@example.com", name: "Lucas Moreau", kind: "Hacker" },
  { email: "hannah.brooks@example.com", name: "Hannah Brooks", kind: "Mentor" },
  { email: "ravi.shah@example.com", name: "Ravi Shah", kind: "Mentor" },
  { email: "elena.petrova@example.com", name: "Elena Petrova", kind: "Judge" },
  { email: "jordan.taylor@example.com", name: "Jordan Taylor", kind: "Mentor & judge" },
];
