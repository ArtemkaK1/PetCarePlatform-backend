import type {Timestamp} from "firebase-admin/firestore";

export type PetSpecies = "dog" | "cat" | "other";
export type PetSex = "male" | "female" | "unknown";

export interface Pet {
  birthDate?: Timestamp;
  createdAt: Timestamp;
  name: string;
  ownerId: string;
  sex: PetSex;
  species: PetSpecies;
  updatedAt: Timestamp;
}
