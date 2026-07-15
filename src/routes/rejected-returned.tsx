import { createFileRoute } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/rejected-returned")({
  head: () => ({
    meta: [
      { title: "Rejected / Returned — AUX ASC Dashboard" },
      { name: "description", content: "Rejected tickets and returned units — reasons and recovery paths." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Rejected / Returned"
      subtitle="Rejections, returns and recovery"
      icon={Undo2}
      description="Consolidate rejected documents and returned units in one place: reason categories, responsible party, and what happened after rejection."
      planned={[
        "Rejection reasons breakdown",
        "Return-to-warehouse volume",
        "Days lost to rejection",
        "Repeat-rejection customers",
        "Recovery outcome (reopen / close)",
        "By branch & product line",
      ]}
    />
  ),
});