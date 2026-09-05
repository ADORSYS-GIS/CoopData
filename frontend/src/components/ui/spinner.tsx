import * as React from "react";

import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
  xl: "size-10",
} as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof sizes;
  label?: string;
}

/**
 * Spinner — a clean, distinctive loading indicator.
 * A faint full ring (track) with a rotating gradient arc that inherits the
 * surrounding text color (use `text-primary`, `text-accent`, etc. to tint it).
 */
export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-block shrink-0", sizes[size], className)}
      {...props}
    >
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-15" />
      <span
        className="absolute inset-0 animate-spin rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, currentColor 100deg, transparent 200deg)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
        }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
