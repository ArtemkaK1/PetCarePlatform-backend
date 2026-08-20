import type {
  CareTaskRecurrence,
  CareTaskRecurrenceFrequency,
} from "./care-task";

export const MAX_RECURRENCE_INTERVAL = 12;

const supportedFrequencies = new Set<CareTaskRecurrenceFrequency>([
  "daily",
  "weekly",
  "monthly",
]);

function assertValidRecurrence(recurrence: CareTaskRecurrence): void {
  if (!supportedFrequencies.has(recurrence.frequency) ||
      !Number.isInteger(recurrence.interval) ||
      recurrence.interval < 1 ||
      recurrence.interval > MAX_RECURRENCE_INTERVAL) {
    throw new RangeError(
      "Recurrence must use daily, weekly, or monthly with an interval from 1 to 12.",
    );
  }
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

export function calculateNextDueAt(
  currentDueAt: Date,
  recurrence: CareTaskRecurrence,
): Date {
  if (!Number.isFinite(currentDueAt.getTime())) {
    throw new RangeError("Current due date must be valid.");
  }
  assertValidRecurrence(recurrence);

  if (recurrence.frequency === "monthly") {
    return addUtcMonths(currentDueAt, recurrence.interval);
  }

  const result = new Date(currentDueAt.getTime());
  const days = recurrence.frequency === "weekly" ?
    recurrence.interval * 7 : recurrence.interval;
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
