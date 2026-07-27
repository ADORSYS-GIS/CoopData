import React from "react";
import { ReportDataProps } from "./types";

export const ReportCoverPage: React.FC<ReportDataProps> = ({
  submission,
  submissionId,
  coopName,
}) => {
  return (
    <div className="relative flex flex-col justify-between w-[210mm] h-[296mm] p-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white page-break-after">
      <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between border-b border-slate-700/60 pb-8">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-blue-500 grid place-items-center text-white font-bold text-lg">C</div>
          <div>
            <p className="text-sm font-bold tracking-wider text-slate-300">CoopData</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">Oversight Platform</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] uppercase font-bold tracking-widest text-blue-400">
          Official Report
        </span>
      </div>

      <div className="my-auto space-y-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
          Annual Financial & Compliance Assessment
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white border-l-4 border-blue-500 pl-6">
          {coopName.toUpperCase()}
        </h1>
        <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light font-sans">
          Comprehensive audit, prudential ratio evaluation, and risk profiling for the reporting year.
        </p>
      </div>

      <div className="border-t border-slate-700/60 pt-8 grid grid-cols-3 gap-6 text-xs text-slate-400">
        <div>
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Reporting Year</p>
          <p className="text-sm font-bold text-white">{submission.reporting_year}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Submission Code</p>
          <p className="text-sm font-mono text-white">SUB-{submission.reporting_year}-{submissionId.slice(0, 5).toUpperCase()}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Generated Date</p>
          <p className="text-sm font-bold text-white">
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
};
