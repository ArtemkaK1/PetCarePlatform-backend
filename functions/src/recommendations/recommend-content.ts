import type {ContentSpecies} from "../content/content";

export type RecommendationReason =
  | "species_match"
  | "breed_match"
  | "age_match"
  | "country_match";

export interface RecommendationPet {
  ageGroup?: string;
  breed?: string;
  countryCode?: string;
  species: ContentSpecies;
}

export interface RecommendableContent {
  ageGroups?: string[];
  breeds?: string[];
  countryCodes?: string[];
  id: string;
  species: ContentSpecies[];
}

export interface ScoredRecommendation<T extends RecommendableContent> {
  content: T;
  reasons: RecommendationReason[];
  score: number;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function includesNormalized(values: string[] | undefined, value: string): boolean {
  return values?.some((candidate) => normalized(candidate) === normalized(value)) ??
    false;
}

export function derivePetAgeGroup(
  species: ContentSpecies,
  birthDate: Date | undefined,
  asOf: Date,
): string | undefined {
  if (birthDate === undefined ||
      !Number.isFinite(birthDate.getTime()) ||
      !Number.isFinite(asOf.getTime()) ||
      birthDate.getTime() > asOf.getTime()) {
    return undefined;
  }

  let ageInMonths = (asOf.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    asOf.getUTCMonth() - birthDate.getUTCMonth();
  if (asOf.getUTCDate() < birthDate.getUTCDate()) {
    ageInMonths -= 1;
  }

  if (ageInMonths < 12) {
    return species === "dog" ? "puppy" : species === "cat" ? "kitten" : "young";
  }
  if (ageInMonths >= 84) {
    return "senior";
  }
  return "adult";
}

export function recommendContent<T extends RecommendableContent>(
  pet: RecommendationPet,
  content: readonly T[],
  limit: number,
): ScoredRecommendation<T>[] {
  return content
    .filter((item) => item.species.includes(pet.species))
    .map((item): ScoredRecommendation<T> => {
      let score = 100;
      const reasons: RecommendationReason[] = ["species_match"];

      if (pet.breed !== undefined && includesNormalized(item.breeds, pet.breed)) {
        score += 30;
        reasons.push("breed_match");
      }
      if (pet.ageGroup !== undefined &&
          includesNormalized(item.ageGroups, pet.ageGroup)) {
        score += 20;
        reasons.push("age_match");
      }
      if (pet.countryCode !== undefined &&
          includesNormalized(item.countryCodes, pet.countryCode)) {
        score += 10;
        reasons.push("country_match");
      }

      return {content: item, reasons, score};
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.content.id === right.content.id) {
        return 0;
      }
      return left.content.id < right.content.id ? -1 : 1;
    })
    .slice(0, limit);
}
