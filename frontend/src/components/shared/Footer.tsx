import React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, FileText, Cookie, Scale, Server } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Footer: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const links = [
    { to: "/legal/terms", label: t("legal.termsOfService", "Terms of Service"), icon: FileText },
    { to: "/legal/privacy", label: t("legal.privacyPolicy", "Privacy Policy"), icon: Lock },
    { to: "/legal/cookies", label: t("legal.cookiePolicy", "Cookie Policy"), icon: Cookie },
    { to: "/legal/acceptable-use", label: t("legal.acceptableUse", "Acceptable Use"), icon: Scale },
    { to: "/legal/security", label: t("legal.securityProtection", "Security & Protection"), icon: ShieldCheck },
    { to: "/legal/data-retention", label: t("legal.dataRetention", "Data Retention"), icon: Server },
  ];

  return (
    <footer className={`border-t border-border/60 bg-surface/50 backdrop-blur-md py-6 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src="/coopdatalogo.png" alt="CoopData Logo" className="h-5 w-auto rounded opacity-80" />
          <span>&copy; {year} CoopData. {t("legal.allRightsReserved", "All rights reserved.")}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
              >
                <Icon className="size-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
};
