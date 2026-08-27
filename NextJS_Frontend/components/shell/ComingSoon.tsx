import { Hammer } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export interface ComingSoonProps {
  title: string;
  description?: string;
  /** Optional caption inside the empty state. */
  note?: string;
}

/**
 * Intentional placeholder for routes that other agents will implement.
 * Renders a real PageHeader + EmptyState so the shell looks finished.
 */
export function ComingSoon({ title, description, note }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card flush className="p-0">
        <EmptyState
          icon={<Hammer size={22} />}
          title="Coming soon"
          description={
            note ??
            "This screen is being built. Check back shortly — the layout and data will appear here."
          }
        />
      </Card>
    </div>
  );
}
