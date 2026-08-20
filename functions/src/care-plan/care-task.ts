import type {Timestamp} from "firebase-admin/firestore";

export type CareTaskCategory =
  | "appointment"
  | "exercise"
  | "feeding"
  | "grooming"
  | "medication"
  | "other";
export type CareTaskStatus = "active" | "completed" | "archived";
export type CareTaskSource = "user" | "system_suggestion";
export type CareTaskRecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface CareTaskRecurrence {
  frequency: CareTaskRecurrenceFrequency;
  interval: number;
}

interface CareTaskFields {
  category: CareTaskCategory;
  createdAt: Timestamp;
  note?: string;
  ownerId: string;
  petId: string;
  source: CareTaskSource;
  status: CareTaskStatus;
  title: string;
  updatedAt: Timestamp;
}

export interface OneTimeCareTask extends CareTaskFields {
  dueAt: Timestamp;
  nextDueAt?: never;
  recurrence?: never;
}

export interface RecurringCareTask extends CareTaskFields {
  dueAt?: never;
  nextDueAt: Timestamp;
  recurrence: CareTaskRecurrence;
}

export type CareTask = OneTimeCareTask | RecurringCareTask;
