const MAX_PREVIEW_LINES = 4;
const MAX_PREVIEW_CHARS = 200;

export function formatApprovalDetailLines(details: Record<string, unknown> | undefined, scope: string): string[] {
  return [...formatStructuredDetails(details), `Approval scope: ${scope}\n`];
}

export function formatToolDetailLines(toolName: string, details: Record<string, unknown>): string[] {
  switch (toolName) {
    case "apply_patch":
      return formatApplyPatchLines(details);
    case "run_command":
      return formatSingleValue("Command", details.command);
    case "read_file":
      return formatSingleValue("Path", details.path);
    case "search_text":
      return formatSingleValue("Query", details.query);
    default:
      return formatCompactDetails(details);
  }
}

function formatStructuredDetails(details: Record<string, unknown> | undefined): string[] {
  if (!details) {
    return [];
  }

  if (isApplyPatchDetails(details)) {
    return formatApplyPatchLines(details);
  }

  if (typeof details.command === "string") {
    return formatSingleValue("Command", details.command);
  }

  return formatCompactDetails(details);
}

function isApplyPatchDetails(details: Record<string, unknown>): boolean {
  return (
    typeof details.path === "string" &&
    ("searchText" in details || "replaceText" in details || "operation" in details)
  );
}

function formatApplyPatchLines(details: Record<string, unknown>): string[] {
  const searchText = readOptionalString(details.searchText);
  const replaceText = readOptionalString(details.replaceText);
  const operation = readOptionalString(details.operation) ?? inferApplyPatchOperation(searchText);

  return [
    ...formatSingleValue("Path", details.path),
    operation ? `Operation: ${operation}\n` : "",
    ...formatPreviewValue("Search preview", searchText),
    ...formatPreviewValue("Replace preview", replaceText),
  ].filter((line) => line.length > 0);
}

function inferApplyPatchOperation(searchText: string | undefined): string {
  return searchText && searchText.length > 0 ? "targeted_replacement" : "full_write";
}

function formatSingleValue(label: string, value: unknown): string[] {
  const text = readOptionalString(value);

  if (!text) {
    return [];
  }

  if (text.includes("\n") || text.length > 100) {
    return formatPreviewValue(label, text);
  }

  return [`${label}: ${text}\n`];
}

function formatPreviewValue(label: string, value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return [`${label}:\n`, ...indentPreview(value)];
}

function indentPreview(value: string): string[] {
  return createPreview(value)
    .split("\n")
    .map((line) => `  ${line}\n`);
}

function createPreview(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n");

  if (normalized.length === 0) {
    return "(empty string)";
  }

  const lines = normalized.split("\n");
  const limitedLines = lines.slice(0, MAX_PREVIEW_LINES);
  let preview = limitedLines.join("\n");
  let truncated = lines.length > MAX_PREVIEW_LINES;

  if (preview.length > MAX_PREVIEW_CHARS) {
    preview = preview.slice(0, MAX_PREVIEW_CHARS);
    truncated = true;
  }

  return truncated ? `${preview}\n...` : preview;
}

function formatCompactDetails(details: Record<string, unknown>): string[] {
  return Object.entries(details).flatMap(([key, value]) => formatSingleValue(toLabel(key), value));
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}
