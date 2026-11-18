/** One problem found while resolving or validating a storyboard. Fed back verbatim to the model during repair. */
export type ValidationIssue = {
  sceneId?: string;
  elementId?: string;
  /** The offending field, e.g. "index", "terms", "traceStep", "indices". */
  field?: string;
  message: string;
  /** Set when the message doesn't already say what the value should be and what it is. */
  expected?: string;
  actual?: string;
};

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

/** `scene "check-1" › element "sum" › terms: message (expected …, got …)`. */
export function formatIssue(issue: ValidationIssue): string {
  const where = [
    issue.sceneId && `scene "${issue.sceneId}"`,
    issue.elementId && `element "${issue.elementId}"`,
    issue.field,
  ]
    .filter(Boolean)
    .join(" › ");
  const values =
    issue.expected !== undefined || issue.actual !== undefined
      ? ` (expected ${issue.expected ?? "?"}, got ${issue.actual ?? "nothing"})`
      : "";
  return `${where ? `${where}: ` : ""}${issue.message}${values}`;
}

type Located = Pick<ValidationIssue, "sceneId" | "elementId" | "field">;

const at = (value: unknown, key: PropertyKey) =>
  value !== null && typeof value === "object" ? (value as Record<PropertyKey, unknown>)[key] : undefined;

const idOf = (value: unknown) => {
  const id = at(value, "id");
  return typeof id === "string" ? id : undefined;
};

/**
 * Turn a Zod path like `scenes.3.elements.2.terms` into scene/element ids from the parsed input, so errors point at
 * `scene "check-1" › element "sum" › terms` instead of array positions. Returns undefined for other paths.
 */
export function locatePath(input: unknown, path: readonly PropertyKey[]): Located | undefined {
  if (path[0] !== "scenes" || typeof path[1] !== "number") return undefined;
  const scene = at(at(input, "scenes"), path[1]);
  const sceneId = idOf(scene) ?? `#${path[1]}`;
  if (path[2] !== "elements" || typeof path[3] !== "number") {
    return { sceneId, field: path.slice(2).map(String).join(".") || undefined };
  }
  const element = at(at(scene, "elements"), path[3]);
  return {
    sceneId,
    elementId: idOf(element) ?? `#${path[3]}`,
    field: path.slice(4).map(String).join(".") || undefined,
  };
}

/** Zod issues as ValidationIssues. Pass the parsed input to locate scene/element ids. */
export function zodIssues(
  prefix: string,
  issues: readonly { path: PropertyKey[]; message: string }[],
  input?: unknown,
): ValidationIssue[] {
  return issues.map((i) => {
    const located = input === undefined ? undefined : locatePath(input, i.path);
    if (located) return { ...located, message: `${prefix}${i.message}` };
    return { message: `${prefix}${i.path.map(String).join(".") || "(root)"}: ${i.message}` };
  });
}
