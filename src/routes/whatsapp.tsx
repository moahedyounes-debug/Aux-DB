import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — AUX ASC Dashboard" },
      { name: "description", content: "WhatsApp conversations and agent performance." },
      { property: "og:title", content: "WhatsApp — AUX ASC Dashboard" },
      { property: "og:description", content: "Chat volume, first-reply time and agent workload." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="WhatsApp"
      subtitle="Live data not yet available in the main sheet"
      icon={MessageSquare}
      description="This module needs a WhatsApp tab in the primary Google Sheet before it can render live conversation and agent metrics."
      planned={[
        "Conversations per channel",
        "Average first-reply time",
        "Agent performance & load",
        "Peak messaging hours",
      ]}
    />
  ),
});
