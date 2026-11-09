import React from "react";

import { ConsentHistoryTable } from "./privacy/ConsentHistoryTable";
import { ConsentStatusCard } from "./privacy/ConsentStatusCard";

/** The user's legal agreements and consent history. */
export const PrivacySecuritySettings: React.FC = () => (
  <div className="space-y-6">
    <ConsentStatusCard />
    <ConsentHistoryTable />
  </div>
);
