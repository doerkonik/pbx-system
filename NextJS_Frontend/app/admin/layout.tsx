import { DashboardShell } from "@/components/shell/DashboardShell";

// Auth-gated, fully client-driven dashboard — never statically prerender it.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="admin" homeHref="/admin">
      {children}
    </DashboardShell>
  );
}
