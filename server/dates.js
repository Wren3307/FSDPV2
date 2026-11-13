// Date helpers shared by the attendance routes and the seed.
// Dates are stored in SQLite as 'YYYY-MM-DD' text, so everything here works on that format.

// Today as YYYY-MM-DD in the server's own time zone. toISOString() alone is UTC,
// which gives the wrong day before 8am in Singapore.
export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// True only for real calendar dates like 2026-11-16. The round trip catches
// dates such as 2026-02-31, which JavaScript would quietly roll into March.
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// ISO weekday for a YYYY-MM-DD string: 1 = Monday ... 7 = Sunday, matching classes.day_of_week.
export function isoWeekday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

// The date `days` days after `date` (use a negative number to go back).
export function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

// Whole days from `earlier` to `later`. Both parse as UTC midnight, so there are no DST surprises.
export function daysBetween(earlier, later) {
  return (Date.parse(later) - Date.parse(earlier)) / 86_400_000;
}
