import React from "react";

interface ConsolidatedCoverPageProps {
  tier: "Apex" | "Federation" | "Ministry";
  entityName: string;
  year: number;
  totalCooperatives: number;
  submittedCooperatives: number;
  totalApexes?: number;
}

export const ConsolidatedCoverPage: React.FC<ConsolidatedCoverPageProps> = ({
  tier,
  entityName,
  year,
  totalCooperatives,
  submittedCooperatives,
  totalApexes,
}) => {
  const submissionRate = totalCooperatives > 0 
    ? ((submittedCooperatives / totalCooperatives) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="relative flex flex-col justify-between w-[210mm] h-[296mm] p-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white break-after-page">
      <div className="absolute right-[-2rem] top-[-2rem] w-80 h-80 bg-blue-900/30 rounded-full flex items-center justify-center pointer-events-none border-[8px] border-slate-800">
        <img src="/coopdatalogo.png" alt="CoopData Logo" className="w-48 h-48 object-contain opacity-90 translate-x-[-1rem] translate-y-[1rem]" />
      </div>

      <div className="flex items-center justify-between border-b border-slate-700/60 pb-8 relative z-10">
        <div className="flex items-center">
          <h2 className="text-3xl font-black tracking-widest text-slate-200 uppercase">
            Official {tier} Report
          </h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-widest text-emerald-400">
          Supervisory Analytics
        </span>
      </div>

      <div className="my-auto space-y-6 relative z-10">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
          Consolidated Sector Performance
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white border-l-4 border-blue-500 pl-6">
          {tier === "Ministry" ? "ESWATINI NATIONAL OVERVIEW" : entityName.toUpperCase()}
        </h1>
        <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light font-sans">
          Aggregated financial performance, portfolio quality, and prudential compliance for cooperatives under supervision.
        </p>
      </div>

      <div className="border-t border-slate-700/60 pt-8 flex gap-8 text-xs text-slate-400 relative z-10 flex-wrap">
        <div className="flex-1 min-w-[80px]">
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Reporting Year</p>
          <p className="text-sm font-bold text-white">{year}</p>
        </div>
        {totalApexes !== undefined && (
          <div className="flex-1 min-w-[80px]">
            <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Active Apexes</p>
            <p className="text-sm font-bold text-white">{totalApexes}</p>
          </div>
        )}
        <div className="flex-1 min-w-[80px]">
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Supervised Co-ops</p>
          <p className="text-sm font-bold text-white">{totalCooperatives}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Submission Rate</p>
          <p className="text-sm font-bold text-white">{submittedCooperatives} ({submissionRate}%)</p>
        </div>
        <div className="flex-1 min-w-[80px]">
          <p className="uppercase tracking-widest text-[9px] text-slate-500 font-bold mb-1">Generated Date</p>
          <p className="text-sm font-bold text-white">
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
};
