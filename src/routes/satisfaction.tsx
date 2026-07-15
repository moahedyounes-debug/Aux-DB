import { createFileRoute } from "@tanstack/react-router";
import { Smile } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/satisfaction")({
  head: () => ({
    meta: [
      { title: "Satisfaction (CSAT) — AUX ASC Dashboard" },
      { name: "description", content: "Post-service customer satisfaction scores by branch, worker and product." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Satisfaction (CSAT)"
      subtitle="Post-service customer feedback"
      icon={Smile}
      description="CSAT and NPS captured after each closed ticket, sliced by branch, technician, product line and issue type."
      planned={[
        "CSAT trend (30 / 90 / 365 d)",
        "Response rate per channel",
        "Detractor comments feed",
        "Score per technician / branch",
        "Correlation with SLA & repeat visits",
        "Follow-up task queue",
      ]}
    />
  ),
});