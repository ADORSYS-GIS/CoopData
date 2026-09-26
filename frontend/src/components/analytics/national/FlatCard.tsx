import type { ComponentProps } from "react";

import { Card } from "@/components/app-shell";

type FlatCardProps = ComponentProps<typeof Card>;

/**
 * Analytics card without the elevation shadow, so every analytics panel matches
 * the flat look of the Basic Analytics dashboard.
 */
export function FlatCard({ className = "", ...props }: FlatCardProps) {
  return <Card {...props} className={`!shadow-none hover:!shadow-none ${className}`} />;
}
