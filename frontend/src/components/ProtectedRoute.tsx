import { Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/constants/roles";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";
import { UnauthorizedPage } from "@/components/UnauthorizedPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-accent" />
          <p className="text-sm text-muted-foreground">Verifying credentials…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!user) {
    return <UnauthorizedPage />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return <UnauthorizedPage />;
    }
  }

  return <>{children}</>;
}

export function RoleRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <UnauthorizedPage />;
  }

  const redirectPath = ROLE_DEFAULT_ROUTE[user.role];
  return <Navigate to={redirectPath} />;
}
