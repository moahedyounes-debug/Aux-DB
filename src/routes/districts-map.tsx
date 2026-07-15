import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/districts-map")({
  head: () => ({
    meta: [
      { title: "Districts Map — AUX ASC Dashboard" },
      { name: "description", content: "Geographic map of tickets down to district level with coverage gaps." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Districts Map"
      subtitle="Geographic view down to the district"
      icon={MapPin}
      description="Interactive map showing ticket density, SLA compliance and coverage gaps at the district level — complements the City Breakdown page."
      planned={[
        "Choropleth by district",
        "SLA overlay (48h / 72h)",
        "Coverage gap detection",
        "Nearest ASC assignment",
        "Drill-down: district → tickets",
        "Filter by product & period",
      ]}
    />
  ),
});