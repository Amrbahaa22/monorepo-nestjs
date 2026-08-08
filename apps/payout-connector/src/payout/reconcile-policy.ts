export const MAX_RECONCILE_ATTEMPTS = 10;

export type ReconcileNext =
  | { readonly kind: "resolve"; readonly outcome: "settled" | "rejected" }
  | { readonly kind: "poll-again"; readonly attempt: number }
  | { readonly kind: "escalate-to-operator" };

/**
 * The rule that keeps this service safe: an ambiguous result is never retried
 * by re-sending. It is polled until the partner reports a terminal status, and
 * escalated to a human if it never does.
 */
export function nextReconcileStep(
  railKind: "settled" | "rejected" | "ambiguous",
  attempt: number,
): ReconcileNext {
  if (railKind !== "ambiguous") {
    return { kind: "resolve", outcome: railKind };
  }
  if (attempt + 1 >= MAX_RECONCILE_ATTEMPTS) {
    return { kind: "escalate-to-operator" };
  }
  return { kind: "poll-again", attempt: attempt + 1 };
}
