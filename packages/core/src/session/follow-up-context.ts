import type { FollowUpContext, SessionArtifact } from "@code-orb/schemas";

export function buildFollowUpContext(artifact: SessionArtifact): FollowUpContext {
  return {
    priorSessionId: artifact.sessionId,
    priorTask: artifact.task,
    priorOutcome: artifact.outcome,
    priorSummary: artifact.summary,
    priorChangedFiles: artifact.changedFiles,
    priorValidations: artifact.validations,
    priorRisks: artifact.risks,
    priorNotes: artifact.notes,
  };
}
