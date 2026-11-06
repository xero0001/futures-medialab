import { operationKinds, type OperationKind } from "./operations-types";
export type OperationsFilter = {
  kind: OperationKind | "all";
  assignee: "all" | "mine" | "unassigned";
  deadline: "all" | "overdue" | "soon";
  q: string;
  page: number;
  campaignId?: string;
};
export function operationsFilter(params: URLSearchParams): OperationsFilter {
  const kind = params.get("kind") ?? "all",
    assignee = params.get("assignee") ?? "all",
    deadline = params.get("deadline") ?? "all",
    page = Number(params.get("page") ?? "1"),
    q = (params.get("q") ?? "").trim();
  if (
    (kind !== "all" && !operationKinds.includes(kind as OperationKind)) ||
    !["all", "mine", "unassigned"].includes(assignee) ||
    !["all", "overdue", "soon"].includes(deadline) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    q.length > 160
  )
    throw new Error("INVALID_FILTER");
  const campaignId = params.get("campaignId") ?? undefined;
  if (campaignId && !/^[a-zA-Z0-9_-]{1,120}$/.test(campaignId))
    throw new Error("INVALID_FILTER");
  return {
    campaignId,
    kind: kind as OperationsFilter["kind"],
    assignee: assignee as OperationsFilter["assignee"],
    deadline: deadline as OperationsFilter["deadline"],
    q,
    page,
  };
}
export function safeDocumentUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      u.hostname !== "example.invalid"
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function operationsDate(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}
