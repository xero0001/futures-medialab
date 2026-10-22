import { requireAdminPage } from "../lib/access";
import { AdminConsole } from "./admin-console";
export const preferredRegion = "sin1";
export default async function AdminHomePage() {
  const admin = await requireAdminPage();
  return <AdminConsole name={admin.name} userId={admin.userId} />;
}
