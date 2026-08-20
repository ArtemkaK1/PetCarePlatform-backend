import type {Timestamp} from "firebase-admin/firestore";

export type ClinicStatus = "hidden" | "published";

export interface ClinicDocument {
  address: string;
  bookingUrl?: string;
  city: string;
  countryCode: string;
  createdAt: Timestamp;
  emergency?: boolean;
  latitude?: number;
  longitude?: number;
  name: string;
  phone?: string;
  services: string[];
  status: ClinicStatus;
  tags: string[];
  updatedAt: Timestamp;
  websiteUrl?: string;
}

export interface ClinicFixture extends Omit<
  ClinicDocument,
  "createdAt" | "updatedAt"
> {
  createdAt: string;
  id: string;
  updatedAt: string;
}
