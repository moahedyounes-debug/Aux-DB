import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageSquare, Users, Clock, Send } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { callsQueryOptions } from "@/lib/aux/queries";

export const Route = createFileRoute("/whatsapp")({
  loader: ({ context }) => context.queryClient.ensureQueryData(callsQueryOptions),
  head: () => ({
    meta: [
      { title: "WhatsApp — AUX ASC Dashboard" },
      { name: "description", content: "WhatsApp conversations, inboxes, agent performance and resolution times." },
      { property: "og:title", content: "WhatsApp — AUX ASC Dashboard" },
      { property: "og:description", content: "WhatsApp channel activity and agent SLA metrics." },
    ],
  }),
  component: WhatsAppPage,
});

const num = new Intl.NumberFormat("en-US");

function WhatsAppPage() {
  const { data } = useSuspenseQuery(callsQueryOptions);
  const w = data.whatsapp;
  const totalMsgs = w.agents.reduce((s, a) => s + a.msgSent, 0);
  const totalClosed = w.agents.reduce((s, a) => s + a.closed, 0);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    color: "var(--color-popover-foreground)",
    fontSize: 12,
  } as const;

  return (
    <DashboardLayout title="WhatsApp" subtitle={`${num.format(w.totalConversations)} conversations · ${num.format(w.uniqueContacts)} unique contacts`}>
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Conversations" value={num.format(w.totalConversations)} icon={MessageSquare} tone="primary" />
        <KpiCard label="Unique Contacts" value={num.format(w.uniqueContacts)} icon={Users} tone="accent" />
        <KpiCard label="Messages Sent" value={num.format(totalMsgs)} hint="Agent replies" icon={Send} tone="success" />
        <KpiCard label="Closed" value={num.format(totalClosed)} icon={Clock} tone="warning" />
      </section>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Conversations by Month"
          subtitle="Growth trend"
          exportRows={w.byMonth.map((m) => ({ Month: m.month, Conversations: m.conversations }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={w.byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="conversations" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Conversations by Hour"
          subtitle="When customers reach out"
          exportRows={w.byHour.map((h) => ({ Hour: h.hour, Conversations: h.conversations }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={w.byHour} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}:00`} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v}:00`} />
              <Line dataKey="conversations" stroke="var(--color-chart-3)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-5 grid-cols-1 xl:grid-cols-2">
        <ChartCard
          title="Inboxes"
          subtitle="Conversation distribution across WhatsApp inboxes"
          exportRows={w.byInbox.map((i) => ({ Inbox: i.inbox, Count: i.count }))}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={w.byInbox.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="inbox" stroke="var(--color-muted-foreground)" fontSize={10} width={180} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Agent Performance"
          subtitle="Monthly WhatsApp handling"
          exportRows={w.agents.map((a) => ({
            Month: a.month, Agent: a.name, Assigned: a.assigned, Closed: a.closed,
            "Unique Closed": a.uniqueClosed, "Messages Sent": a.msgSent,
            "Avg Resolution": a.avgResolution, ART: a.art,
          }))}
        >
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 text-start">Month</th>
                  <th className="py-2 pr-4 text-start">Agent</th>
                  <th className="py-2 pr-4 text-end">Assigned</th>
                  <th className="py-2 pr-4 text-end">Closed</th>
                  <th className="py-2 pr-4 text-end">Msgs</th>
                  <th className="py-2 pr-4 text-end">Avg Res.</th>
                </tr>
              </thead>
              <tbody>
                {w.agents.map((a, i) => (
                  <tr key={`${a.month}-${a.name}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{a.month}</td>
                    <td className="py-2 pr-4 text-xs font-medium">{a.name}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(a.assigned)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-success">{num.format(a.closed)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums">{num.format(a.msgSent)}</td>
                    <td className="py-2 pr-4 text-end tabular-nums text-xs">{a.avgResolution || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}