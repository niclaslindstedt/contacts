// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The birthday maths. A contact stores its birthday as an ISO `YYYY-MM-DD`
// string (see `types.ts`); the read view wants two things a raw date can't tell
// it at a glance — how many days remain until the next one, and how old the
// contact is right now. Both live here as pure functions that take the
// reference "now" as an argument (the component passes `new Date()`), so the
// whole surface is deterministic and unit-testable in node
// (see `tests/birthday_test.ts`).

/** Parse a plain calendar `YYYY-MM-DD` into its parts, or null when the string
 *  isn't a real date (rejects impossible days like `2001-02-30`). */
function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(y, mo - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== mo - 1 ||
    probe.getDate() !== d
  ) {
    return null;
  }
  return { y, m: mo, d };
}

/** Whole years old on `now`, or null when the date is invalid or lies in the
 *  future (a not-yet-born birthday has no age to show). */
export function ageOn(iso: string, now: Date): number | null {
  const p = parseIso(iso);
  if (!p) return null;
  const monthNow = now.getMonth() + 1;
  const hadBirthdayThisYear =
    monthNow > p.m || (monthNow === p.m && now.getDate() >= p.d);
  const age = now.getFullYear() - p.y - (hadBirthdayThisYear ? 0 : 1);
  return age < 0 ? null : age;
}

/** Days until the next occurrence of the birthday: 0 on the day itself, 1 the
 *  day before, counting forward to the same date next year. null when the date
 *  is invalid. A Feb-29 birthday rolls onto Mar 1 in common years. */
export function daysUntilBirthday(iso: string, now: Date): number | null {
  const p = parseIso(iso);
  if (!p) return null;
  const MS_PER_DAY = 86_400_000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), p.m - 1, p.d);
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, p.m - 1, p.d);
  }
  return Math.round((next.getTime() - today.getTime()) / MS_PER_DAY);
}
