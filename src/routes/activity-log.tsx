import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/activity-log")({
  head: () => ({
    meta: [
      { title: "Activity Log — AUX ASC Dashboard" },
      { name: "description", content: "Audit trail of user and system actions across the dashboard." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Activity Log"
      subtitle="Who did what, and when"
      icon={History}
      description="Immutable audit trail of every meaningful action — logins, exports, ticket edits, role changes — with filters for compliance reviews."
      planned={[
        "Login history",
        "Data-export events",
        "Ticket edits with diff",
        "Role / permission changes",
        "Filter by user / date / action",
        "Export audit trail",
      ]}
    />
  ),
});