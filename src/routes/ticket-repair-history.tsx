import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/ticket-repair-history")({
  head: () => ({
    meta: [
      { title: "Repair History — AUX ASC Dashboard" },
      { name: "description", content: "Full lifecycle of every repair ticket with searchable history." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Repair History"
      subtitle="Searchable per-ticket lifecycle"
      icon={Wrench}
      description="Deep dive into a single ticket: every status change, worker, part, note and visit — with unit-level history across previous claims."
      planned={[
        "Ticket search (number / phone / serial)",
        "Status timeline with actor",
        "Repeat visits per unit",
        "Attached photos & notes",
        "Parts used per ticket",
        "Repeat-repair risk flag",
      ]}
    />
  ),
});