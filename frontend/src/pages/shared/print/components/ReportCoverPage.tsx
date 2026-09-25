import React from "react";
import { ReportDataProps } from "./types";

export const ReportCoverPage: React.FC<ReportDataProps> = ({ submission, submissionId, coopName }) => {
  return (
    <section className="rp-cover rp-page">
      {/* Top teal band with red right accent */}
      <div className="rp-band">
        <i />
      </div>

      {/* Inner border frame */}
      <div className="rp-frame" />

      {/* CoopData image logo */}
      <div className="rp-cover-logo">
        <img src="/coopdatalogo.png" alt="CoopData Logo" style={{ height: "100%", objectFit: "contain" }} />
      </div>

      {/* Classification badge */}
      <div className="rp-class">Restricted</div>

      {/* Title block */}
      <div className="rp-cover-title">
        <div className="rp-kicker">ANNUAL FINANCIAL &amp; COMPLIANCE ASSESSMENT</div>
        <h1>{coopName}</h1>
        <div className="rp-rule" />
        <div className="rp-entity">
          Cooperative Society Limited
          <small>Registration: Not Available</small>
        </div>
      </div>

      {/* Meta grid */}
      <div className="rp-cover-meta">
        <div>
          <span>REPORTING PERIOD</span>
          <b>1 Jan - 31 Dec {submission.reporting_year}</b>
        </div>
        <div>
          <span>SUBMISSION REF.</span>
          <b>SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</b>
        </div>
        <div>
          <span>DATE OF ISSUE</span>
          <b>{new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}</b>
        </div>
        <div>
          <span>SUBMISSION STATUS</span>
          <b>{submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}</b>
        </div>
      </div>

      {/* Footer */}
      <div className="rp-cover-foot">
        <div>
          Prepared by Coop Data - Unified Cooperative Financial Intelligence &amp; Compliance
        </div>
        <div style={{ textAlign: "right" }}>
          All amounts in local currency
        </div>
      </div>
    </section>
  );
};

export default ReportCoverPage;
