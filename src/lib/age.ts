// Age / 18+ verification shared by the client form and the server route.

export const MIN_AGE = 18;
export const UNDERAGE_MESSAGE = "You must be at least 18 years old to use this app.";

/** Whole years old for a YYYY-MM-DD date of birth, or null if invalid. */
export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function isAdult(dob: string): boolean {
  const a = ageFromDob(dob);
  return a !== null && a >= MIN_AGE;
}
