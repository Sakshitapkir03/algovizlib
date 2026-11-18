/** One problem found while resolving or validating a storyboard. Fed back verbatim to the model during repair. */
export type ValidationIssue = {
  sceneId?: string;
  elementId?: string;
  message: string;
};

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

export function formatIssue(issue: ValidationIssue): string {
  const where = [
    issue.sceneId && `scene "${issue.sceneId}"`,
    issue.elementId && `element "${issue.elementId}"`,
  ]
    .filter(Boolean)
    .join(", ");
  return where ? `${where}: ${issue.message}` : issue.message;
}

export function zodIssues(
  prefix: string,
  issues: readonly { path: PropertyKey[]; message: string }[],
): ValidationIssue[] {
  return issues.map((i) => ({
    message: `${prefix}${i.path.map(String).join(".") || "(root)"}: ${i.message}`,
  }));
}
