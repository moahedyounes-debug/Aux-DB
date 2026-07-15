import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/custom-dashboard")({
  head: () => ({
    meta: [
      { title: "Custom Dashboard — AUX ASC Dashboard" },
      { name: "description", content: "Build a personal dashboard by dragging KPI cards and charts into place." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Custom Dashboard"
      subtitle="Your own KPI wall"
      icon={LayoutGrid}
      description="Drag-and-drop layout builder — combine any KPI cards, charts and tables from the dashboard into a personal view saved per user."
      planned={[
        "Drag-and-drop grid layout",
        "Widget library (any KPI)",
        "Per-user saved layouts",
        "Shareable dashboard links",
        "Full-screen presentation mode",
        "Auto-refresh intervals",
      ]}
    />
  ),
});