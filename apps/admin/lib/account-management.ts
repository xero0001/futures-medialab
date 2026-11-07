import type { AdminLocation } from "./admin-navigation";
import type { Organization, UserRow } from "./types";

export type AccountType = AdminLocation["accountType"];
export const accountTypes = [
  ["all", "전체"],
  ["BRAND", "브랜드"],
  ["AGENCY", "에이전시"],
] as const;

export function filterAccounts(
  users: UserRow[],
  type: AccountType,
  status: string,
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return users.filter((user) => {
    const memberships = user.organizations.filter(
      (org) =>
        (type === "all" || org.type === type) &&
        (status === "all" || org.status === status),
    );
    return (
      ((type === "all" && status === "all") || memberships.length > 0) &&
      `${user.name ?? ""} ${user.email} ${memberships.map((org) => org.name).join(" ")}`
        .toLocaleLowerCase()
        .includes(needle)
    );
  });
}

export function filterReviews(
  organizations: Organization[],
  type: AccountType,
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return organizations.filter(
    (org) =>
      org.status === "PENDING" &&
      ["BRAND", "AGENCY"].includes(org.type) &&
      (type === "all" || org.type === type) &&
      org.name.toLocaleLowerCase().includes(needle),
  );
}
