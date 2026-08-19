export const allowedRemoteProjectId = "volrik-pet-care-platform";

export interface SeedArguments {
  confirmRemote: boolean;
  projectId?: string;
  remote: boolean;
}

export type SeedTarget =
  | {mode: "emulator"; projectId: typeof allowedRemoteProjectId}
  | {mode: "remote"; projectId: typeof allowedRemoteProjectId};

export function parseSeedArguments(args: readonly string[]): SeedArguments {
  let confirmRemote = false;
  let projectId: string | undefined;
  let remote = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--remote") {
      remote = true;
    } else if (argument === "--confirm-remote-seed") {
      confirmRemote = true;
    } else if (argument === "--project") {
      projectId = args[index + 1];
      if (projectId === undefined) {
        throw new Error("--project requires a project ID.");
      }
      index += 1;
    } else {
      throw new Error(`Unknown seed argument: ${String(argument)}`);
    }
  }

  return {confirmRemote, projectId, remote};
}

export function resolveSeedTarget(
  arguments_: SeedArguments,
  emulatorHost: string | undefined,
): SeedTarget {
  if (!arguments_.remote) {
    if (arguments_.confirmRemote || arguments_.projectId !== undefined) {
      throw new Error("Remote flags require --remote.");
    }
    if (emulatorHost === undefined || emulatorHost.length === 0) {
      throw new Error(
        "Local seeding requires FIRESTORE_EMULATOR_HOST. Use the root npm seed script.",
      );
    }
    return {mode: "emulator", projectId: allowedRemoteProjectId};
  }

  if (!arguments_.confirmRemote) {
    throw new Error("Remote seeding requires --confirm-remote-seed.");
  }
  if (arguments_.projectId !== allowedRemoteProjectId) {
    throw new Error(
      `Remote seeding is allowed only for project '${allowedRemoteProjectId}'.`,
    );
  }

  return {mode: "remote", projectId: allowedRemoteProjectId};
}
