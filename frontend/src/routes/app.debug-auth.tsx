import { createFileRoute } from "@tanstack/react-router";
import { DebugAuth } from "@/pages/DebugAuth";

export const Route = createFileRoute("/app/debug-auth")({
  component: DebugAuth,
});
