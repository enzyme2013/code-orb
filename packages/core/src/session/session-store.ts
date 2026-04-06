import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SessionArtifact } from "@code-orb/schemas";

export interface StoredSessionArtifact extends SessionArtifact {
  artifactPath: string;
}

export interface SessionStore {
  save(artifact: SessionArtifact): Promise<StoredSessionArtifact>;
  list(cwd: string): Promise<StoredSessionArtifact[]>;
  load(cwd: string, sessionId: string): Promise<StoredSessionArtifact | null>;
  getArtifactPath(cwd: string, sessionId: string): string;
}

export class LocalSessionStore implements SessionStore {
  async save(artifact: SessionArtifact): Promise<StoredSessionArtifact> {
    const artifactPath = this.getArtifactPath(artifact.cwd, artifact.sessionId);

    await mkdir(this.getStoreDirectory(artifact.cwd), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

    return {
      ...artifact,
      artifactPath,
    };
  }

  async list(cwd: string): Promise<StoredSessionArtifact[]> {
    const storeDirectory = this.getStoreDirectory(cwd);
    let entries: string[];

    try {
      entries = await readdir(storeDirectory);
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }

      throw error;
    }

    const artifacts = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          const artifactPath = join(storeDirectory, entry);
          const artifact = await this.readArtifact(artifactPath);

          return {
            ...artifact,
            artifactPath,
          } satisfies StoredSessionArtifact;
        }),
    );

    return artifacts.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  async load(cwd: string, sessionId: string): Promise<StoredSessionArtifact | null> {
    const artifactPath = this.getArtifactPath(cwd, sessionId);

    try {
      const artifact = await this.readArtifact(artifactPath);

      return {
        ...artifact,
        artifactPath,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  getArtifactPath(cwd: string, sessionId: string): string {
    return join(this.getStoreDirectory(cwd), `${sessionId}.json`);
  }

  private getStoreDirectory(cwd: string): string {
    return join(cwd, ".orb", "sessions");
  }

  private async readArtifact(artifactPath: string): Promise<SessionArtifact> {
    const serialized = await readFile(artifactPath, "utf8");
    return JSON.parse(serialized) as SessionArtifact;
  }
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
