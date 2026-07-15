import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/control-panel")({
  head: () => ({
    meta: [
      { title: "Control Panel — AUX ASC Dashboard" },
      { name: "description", content: "Admin control panel: targets, data sources, integrations and branding." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Control Panel"
      subtitle="Admin settings and integrations"
      icon={Settings2}
      description="Central admin surface — SLA targets, data-source credentials, branch registry, integrations, and dashboard branding."
      planned={[
        "SLA target thresholds",
        "Data-source credentials",
        "Branch & product registries",
        "Integrations (Sheets, WA, courier)",
        "Branding & theme",
        "Notification rules",
      ]}
    />
  ),
});