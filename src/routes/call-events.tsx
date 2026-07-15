import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/call-events")({
  head: () => ({
    meta: [
      { title: "Call Events — AUX ASC Dashboard" },
      { name: "description", content: "Call center events, SLA and peak-hour analysis." },
      { property: "og:title", content: "Call Events — AUX ASC Dashboard" },
      { property: "og:description", content: "Answered rate, SLA compliance and peak hours." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Call Events"
      subtitle="Live data not yet available in the main sheet"
      icon={Phone}
      description="This module needs a Calls tab in the primary Google Sheet before it can render live SLA, answer-rate and peak-hour analytics."
      planned={[
        "Total inbound / outbound calls",
        "SLA % (answered within target)",
        "Peak hours & agent utilisation",
        "Abandoned call analysis",
      ]}
    />
  ),
});
