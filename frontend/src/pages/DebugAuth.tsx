import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/services/shared/authService";
import { AppShell } from "@/components/app-shell";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function DebugAuth() {
  const { t } = useTranslation();
  const auth = useAuth();
  const profile = getUserProfile();

  return (
    <AppShell title={t("debugAuth.title")} subtitle={t("debugAuth.subtitle")}>
      <div className="space-y-6">
        <div className="flex gap-4 mb-6">
          <Link
            to="/app/apexes"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t("debugAuth.goToApexes")}
          </Link>
          <Link
            to="/app/profile"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {t("debugAuth.goToProfile")}
          </Link>
          <Link
            to="/app/users"
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            {t("debugAuth.goToUsers")}
          </Link>
          <Link
            to="/app/dashboard"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            {t("debugAuth.backToDashboard")}
          </Link>
        </div>

        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <h4 className="font-bold">{t("debugAuth.testingApiCall")}</h4>
          <button
            onClick={async () => {
              console.log("[DEBUG] Testing API call manually...");
              try {
                const response = await fetch("http://localhost:3000/api/v1/federation/apexes", {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${await auth.getAccessToken()}`,
                    "Content-Type": "application/json",
                  },
                });
                console.log("[DEBUG] API Response status:", response.status);
                console.log(
                  "[DEBUG] API Response headers:",
                  Object.fromEntries(response.headers.entries()),
                );
                const text = await response.text();
                console.log("[DEBUG] API Response body:", text);

                if (response.ok) {
                  try {
                    const data = JSON.parse(text);
                    console.log("[DEBUG] Parsed JSON:", data);
                    alert(
                      `✅ API Success! Got ${Array.isArray(data) ? data.length : "non-array"} items`,
                    );
                  } catch {
                    alert(`✅ API Success but invalid JSON: ${text.substring(0, 100)}`);
                  }
                } else {
                  alert(`❌ API Failed: ${response.status} - ${text}`);
                }
              } catch (e) {
                console.error("[DEBUG] API Error:", e);
                alert(`❌ API Error: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            {t("debugAuth.testApiCallBtn")}
          </button>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">{t("debugAuth.authContext")}</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(
              {
                isAuthenticated: auth.isAuthenticated,
                isLoading: auth.isLoading,
                role: auth.role,
                user: auth.user
                  ? {
                      id: auth.user.id,
                      email: auth.user.email,
                      name: auth.user.name,
                      role: auth.user.role,
                      region: auth.user.region,
                      organizationId: auth.user.organizationId,
                      organizationName: auth.user.organizationName,
                      realmRoles: auth.user.realmRoles,
                    }
                  : null,
              },
              null,
              2,
            )}
          </pre>
        </div>

        <button
          onClick={async () => {
            try {
              const token = await auth.getAccessToken();
              console.log("Raw access token:", token);
              // Decode the token (just the payload part)
              const parts = token.split(".");
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                console.log("Decoded token payload:", payload);
              }
            } catch (e) {
              console.error("Failed to get token:", e);
            }
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          {t("debugAuth.logTokenBtn")}
        </button>
      </div>
    </AppShell>
  );
}
