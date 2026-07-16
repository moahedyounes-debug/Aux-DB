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

export const CANCELLED_RESULT = "cancel the service";

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

/** Return true when a Completion Result value marks the ticket as cancelled. */
export function isCancelledResult(v: unknown): boolean {
  return norm(v) === CANCELLED_RESULT;
}

/** Return true when the Completion Result is blank → ticket is still pending. */
export function isPendingResult(v: unknown): boolean {
  return norm(v) === "";
}

export type CompletionBucket = "closed" | "cancelled" | "pending";

/** Classify a ticket into one of the three buckets based on Completion Result. */
export function classifyCompletion(v: unknown): CompletionBucket {
  const s = norm(v);
  if (!s) return "pending";
  if (s === CANCELLED_RESULT) return "cancelled";
  if (CLOSED_SET.has(s)) return "closed";
  // Any other non-empty value (rejected, returned, …) is treated as pending
  // per the operations spec: only the 5 whitelisted results mean "closed".
  return "pending";
}