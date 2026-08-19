import type {Timestamp} from "firebase-admin/firestore";

export type ContentType = "article" | "video" | "checklist";
export type ContentSpecies = "dog" | "cat" | "other";
export type ContentStatus = "draft" | "published";

export interface ContentDocument {
  ageGroups?: string[];
  body?: string;
  breeds?: string[];
  checklistItems?: string[];
  countryCodes?: string[];
  createdAt: Timestamp;
  externalUrl?: string;
  shortDescription: string;
  species: ContentSpecies[];
  status: ContentStatus;
  title: string;
  topics: string[];
  type: ContentType;
  updatedAt: Timestamp;
}

export interface ContentFixture extends Omit<
  ContentDocument,
  "createdAt" | "updatedAt"
> {
  createdAt: string;
  id: string;
  updatedAt: string;
}
