import type {Timestamp} from "firebase-admin/firestore";

export type PetSpecies = "dog" | "cat" | "other";
export type PetSex = "male" | "female" | "unknown";

export interface Pet {
  birthDate?: Timestamp;
  breed?: string;
  countryCode?: string;
  createdAt: Timestamp;
  name: string;
  ownerId: string;
  sex: PetSex;
  species: PetSpecies;
  updatedAt: Timestamp;
}
