/**
 * A ticket is considered CLOSED only when its "Completion Result" is one of
 * these values. Anything else (blank, cancelled, rejected, …) is treated as
 * NOT closed by every dashboard aggregation.
 */
export const CLOSED_RESULTS = [
  "install",
  "on-site explanation",
  "phone explanation",
  "troubleshooting",
  "value-added services",
] as const;

const CLOSED_SET = new Set<string>(CLOSED_RESULTS);

function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Return true when a Completion Result value marks the ticket as closed. */
export function isClosedResult(v: unknown): boolean {
  const s = norm(v);
  if (!s) return false;
  return CLOSED_SET.has(s);
}