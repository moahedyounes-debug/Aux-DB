import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/export-center")({
  head: () => ({
    meta: [
      { title: "Export Center — AUX ASC Dashboard" },
      { name: "description", content: "One-click exports of any dashboard dataset to CSV or Excel." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Export Center"
      subtitle="Every dataset, one click away"
      icon={Download}
      description="Centralised export hub — pick a dataset, apply filters, and pull it as CSV or Excel. Also schedules recurring emailed reports."
      planned={[
        "All KPI datasets in one list",
        "CSV / Excel / PDF outputs",
        "Filter presets",
        "Scheduled recurring exports",
        "Email delivery to stakeholders",
        "Export history & audit log",
      ]}
    />
  ),
});