import "./i18n";
import i18n from "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import { registerSW } from "virtual:pwa-register";
import { getRouter } from "./router";
import "./styles.css";

// Register Service Worker for instant offline app shell caching in dev & prod
registerSW({ immediate: true });

const router = getRouter();

const rootElement = document.getElementById("root")!;
createRoot(rootElement).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  </StrictMode>,
);

