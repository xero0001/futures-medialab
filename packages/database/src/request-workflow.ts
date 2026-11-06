export type RequestWaitingFor = "proposal-decision" | "brief" | "reply" | null;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const iso = (value: unknown): string | null =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;

export function requestWaitingFor(
  input: unknown,
  status: string,
  hasPublishedProposal = false,
): RequestWaitingFor {
  if (status !== "WAITING_BRAND") return null;
  const data = record(input);
  if (["proposal-decision", "brief", "reply"].includes(String(data.waitingFor)))
    return data.waitingFor as RequestWaitingFor;
  // Older published proposals used a generic WAITING_BRAND intake status.
  if (
    data.kind === "campaign-intake" &&
    hasPublishedProposal &&
    !("waitingFor" in data)
  )
    return "proposal-decision";
  return "reply";
}

export function originalProposalDeadline(input: unknown): string | null {
  const data = record(input);
  const saved = iso(data.originalProposalDueAt);
  if (saved) return saved;
  if (data.kind !== "campaign-intake" || data.route !== "managed") return null;
  const submitted = iso(data.firstSubmittedAt) ?? iso(data.submittedAt);
  return submitted
    ? new Date(Date.parse(submitted) + 48 * 60 * 60 * 1000).toISOString()
    : null;
}
