import { DashboardShell } from "@/components/shell/DashboardShell";
import { SoftphoneProvider } from "@/lib/softphone-context";
import { IncomingCallOverlay } from "@/components/softphone/IncomingCallOverlay";

// Auth-gated, fully client-driven dashboard — never statically prerender it.
export const dynamic = "force-dynamic";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="agent" homeHref="/agent">
      {/* One shared softphone registration for the whole agent panel, so calls
          ring on any page and audio/registration survive navigation. */}
      <SoftphoneProvider>
        <IncomingCallOverlay />
        {children}
      </SoftphoneProvider>
    </DashboardShell>
  );
}
