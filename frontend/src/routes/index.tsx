import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/public/LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
});
