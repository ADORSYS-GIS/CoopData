import React from "react";

import { ConsentHistoryTable } from "./privacy/ConsentHistoryTable";
import { ConsentStatusCard } from "./privacy/ConsentStatusCard";
import { PrivacyRequestForm } from "./privacy/PrivacyRequestForm";

/** The user's legal agreements, data requests and consent history. */
export const PrivacySecuritySettings: React.FC = () => (
  <div className="space-y-6">
    <ConsentStatusCard />
    <PrivacyRequestForm />
    <ConsentHistoryTable />
  </div>
);
