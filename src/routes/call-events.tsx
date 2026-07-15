import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const Route = createFileRoute("/call-events")({
  head: () => ({
    meta: [
      { title: "Call Events — AUX ASC Dashboard" },
      { name: "description", content: "Inbound and outbound call events, durations, and outcomes tied to tickets." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Call Events"
      subtitle="Every call attached to a ticket"
      icon={PhoneCall}
      description="Chronological log of call events per ticket — who called, when, direction, duration, and outcome — for QA and dispute resolution."
      planned={[
        "Timeline per ticket",
        "Missed / abandoned call rate",
        "Average handle time by agent",
        "Callback success ratio",
        "Silent / dropped-call flags",
        "Recording links (optional)",
      ]}
    />
  ),
});