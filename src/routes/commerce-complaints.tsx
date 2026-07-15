import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/commerce-complaints")({
  head: () => ({
    meta: [
      { title: "Commerce Complaints — AUX ASC Dashboard" },
      { name: "description", content: "Ministry of Commerce complaints — intake, SLA, resolution and repeat offenders." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Commerce Complaints"
      subtitle="Ministry of Commerce cases"
      icon={Scale}
      description="Track regulatory complaints separately from normal tickets: mandated response time, evidence pack, escalation path and final ruling."
      planned={[
        "Open cases with SLA countdown",
        "Response time vs regulator target",
        "Root-cause categorisation",
        "Financial exposure per case",
        "Repeat customer / branch pattern",
        "Evidence pack builder",
      ]}
    />
  ),
});