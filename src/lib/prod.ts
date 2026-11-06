// Production-site flag. When the app is built/run with the prod flag set, it
// starts as a REAL platform: no demo users, no sample voice rooms, no fake
// "members" filling seats, no fake player counts — only real sign-ups appear.
// The freelancer demo (escapeweb) is built without it, so it keeps its showcase
// data.
export const IS_PROD_SITE =
  process.env.NEXT_PUBLIC_LOTUS_PROD === "1" || process.env.LOTUS_PROD === "1";
