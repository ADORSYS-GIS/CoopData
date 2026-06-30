import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/lib/route-guards";
import { LoginPage } from "@/pages/public/LoginPage";

export const Route = createFileRoute("/auth/login")({
  beforeLoad: () => {
    redirectIfAuthenticated();
  },
  component: LoginPage,
});
