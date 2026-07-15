import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Access — AUX ASC Dashboard" },
      { name: "description", content: "User accounts, roles and page-level permissions." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Access"
      subtitle="Users, roles and permissions"
      icon={ShieldCheck}
      description="Manage who can log in, what role they hold, and which pages / branches they can see or edit — with invitation and deactivation flows."
      planned={[
        "User directory",
        "Role templates (Admin / Ops / Viewer)",
        "Page-level permission matrix",
        "Branch-scoped access",
        "Invitation & onboarding flow",
        "Session & device management",
      ]}
    />
  ),
});