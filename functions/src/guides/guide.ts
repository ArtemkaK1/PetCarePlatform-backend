import type {Timestamp} from "firebase-admin/firestore";

import type {ContentSpecies} from "../content/content";

export type GuideStatus = "draft" | "published";
export type GuideUrgency =
  | "informational"
  | "consider_professional_help"
  | "urgent_external_help";

export interface GuideAnswerOption {
  id: string;
  label: string;
  score: number;
}

export interface GuideQuestion {
  id: string;
  prompt: string;
  options: GuideAnswerOption[];
}

export interface GuideResult {
  id: string;
  maxScore: number;
  minScore: number;
  recommendedContentIds?: string[];
  suggestClinicRouting?: boolean;
  text: string;
  title: string;
  topics?: string[];
  urgency: GuideUrgency;
}

export interface GuideFields {
  ageGroups?: string[];
  description: string;
  id: string;
  questions: GuideQuestion[];
  results: GuideResult[];
  species: ContentSpecies[];
  status: GuideStatus;
  title: string;
  topics?: string[];
}

export interface GuideDocument extends GuideFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GuideFixture extends GuideFields {
  createdAt: string;
  updatedAt: string;
}

export interface GuideAnswer {
  optionId: string;
  questionId: string;
}

export interface GuideEvaluation {
  result: GuideResult;
  score: number;
}
