import type { MutatingActionReport, ProjectInstructionSource, RepositoryStateReport, RuntimeEvent } from "@code-orb/schemas";

import type { CliIO } from "../main.js";

export class TerminalEventRenderer {
  constructor(private readonly io: Pick<CliIO, "stdout" | "stderr">) {}

  render(event: RuntimeEvent): void {
    const line = this.format(event);

    if (!line) {
      return;
    }

    if (event.type === "error.raised") {
      this.io.stderr.write(line);
      return;
    }

    this.io.stdout.write(line);
  }

  private format(event: RuntimeEvent): string | null {
    switch (event.type) {
      case "session.started":
        return [`Session started: ${event.payload.task}\n`, ...formatProjectInstructions(event.payload.projectInstructions)].join("");
      case "turn.started":
        return `Turn ${event.payload.index + 1}: ${event.payload.input}\n`;
      case "step.started":
        return `Step ${event.payload.index + 1}: ${event.payload.kind}\n`;
      case "assistant.message":
        return `Assistant: ${event.payload.content}\n`;
      case "plan.generated":
        return `Plan: ${event.payload.plan.summary}\n`;
      case "approval.requested":
        return `Approval requested: ${event.payload.approvalRequest.summary}\n`;
      case "approval.completed":
        return `Approval ${event.payload.approvalResponse.decision}: ${event.payload.request.toolName}\n`;
      case "tool.started":
        return `Tool started: ${event.payload.request.toolName}\n`;
      case "tool.finished":
        return `Tool finished: ${event.payload.result.callId} (${event.payload.result.status})\n`;
      case "tool.denied":
        return `Tool denied: ${event.payload.request.toolName} (${event.payload.decision.reason})\n`;
      case "verify.started":
        return `Verification started: ${event.payload.command ?? "unnamed"}\n`;
      case "verify.finished":
        return event.payload.validations
          .map((validation) => `Verification ${validation.status}: ${validation.name}\n`)
          .join("");
      case "turn.completed":
        return [
          `Turn complete: ${event.payload.report.summary}\n`,
          `Turn status: ${event.payload.report.outcome}\n`,
          ...(event.payload.report.filesChanged?.map((path) => `Changed: ${path}\n`) ?? []),
          ...(event.payload.report.validations?.map(
            (validation) => `Validation ${validation.status}: ${validation.name}\n`,
          ) ?? []),
          ...formatNotes(event.payload.report.notes),
          ...formatMutatingActions(event.payload.report.mutatingActions),
          event.payload.report.risks && event.payload.report.risks.length > 0
            ? event.payload.report.risks.map((risk) => `Risk: ${risk}\n`).join("")
            : "Risks: none\n",
        ].join("");
      case "session.completed":
        return [
          `Session complete: ${event.payload.report.summary}\n`,
          `Session outcome: ${event.payload.report.outcome}\n`,
          ...formatProjectInstructions(event.payload.report.projectInstructions),
          ...formatNotes(event.payload.report.notes),
          ...formatMutatingActions(event.payload.report.mutatingActions),
          event.payload.report.followUpFromSessionId
            ? `Follow-up from session: ${event.payload.report.followUpFromSessionId}\n`
            : "",
          ...formatRepositoryState(event.payload.report.repositoryState),
          event.payload.report.artifactPath ? `Session artifact: ${event.payload.report.artifactPath}\n` : "",
        ].join("");
      case "error.raised":
        return `Error: ${event.payload.message}\n`;
      default:
        return null;
    }
  }
}

function formatRepositoryState(report: RepositoryStateReport | undefined): string[] {
  if (!report) {
    return [];
  }

  return [
    report.initialBranch ? `Repository branch before: ${report.initialBranch}\n` : "",
    report.finalBranch ? `Repository branch after: ${report.finalBranch}\n` : "",
    `Repository dirty before run: ${report.wasDirtyBeforeRun ? "yes" : "no"}\n`,
    `Repository dirty after run: ${report.isDirtyAfterRun ? "yes" : "no"}\n`,
    ...(report.changeClassification?.preExistingChangedFiles.map((path) => `Pre-existing change: ${path}\n`) ?? []),
    ...(report.changeClassification?.currentRunChangedFiles.map((path) => `Current-run change: ${path}\n`) ?? []),
    ...(report.changeClassification?.touchedPreExistingFiles.map((path) => `Touched pre-existing file: ${path}\n`) ?? []),
  ];
}

function formatProjectInstructions(instructions: ProjectInstructionSource[] | undefined): string[] {
  if (!instructions || instructions.length === 0) {
    return [];
  }

  return instructions.map((instruction) => `Project instructions: ${instruction.path}\n`);
}

function formatNotes(notes: string[] | undefined): string[] {
  return notes?.map((note) => `Note: ${note}\n`) ?? [];
}

function formatMutatingActions(actions: MutatingActionReport[] | undefined): string[] {
  if (!actions || actions.length === 0) {
    return [];
  }

  return actions.map((action) => {
    const target = action.path ?? action.command;
    return `Mutation ${action.status}: ${action.toolName}${target ? ` (${target})` : ""}\n`;
  });
}
