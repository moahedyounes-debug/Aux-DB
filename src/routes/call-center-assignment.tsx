import { createFileRoute } from "@tanstack/react-router";
import { PhoneForwarded } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/call-center-assignment")({
  head: () => ({
    meta: [
      { title: "Call Assignment — AUX ASC Dashboard" },
      { name: "description", content: "How incoming tickets get routed from the call center to branches and workers." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Call Assignment"
      subtitle="Routing from call center to ASC branches"
      icon={PhoneForwarded}
      description="Visualise how the call center distributes tickets — assignment time, agent load, reassignment loops, and branches that receive the bulk of the work."
      planned={[
        "Tickets per agent (shift breakdown)",
        "Time from create → dispatch",
        "Reassignment / bounce rate",
        "Branch load balance heatmap",
        "Unassigned queue watcher",
        "Peak-hour routing latency",
      ]}
    />
  ),
});