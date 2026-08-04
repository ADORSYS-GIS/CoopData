import React from "react";
import { Sparkles } from "lucide-react";

interface AiInsightBoxProps {
  title?: string;
  content?: string;
  fallbackContent: React.ReactNode;
}

export const AiInsightBox: React.FC<AiInsightBoxProps> = ({
  title = "AI Executive Insight",
  content,
  fallbackContent,
}) => {
  if (content) {
    return (
      <div className="mb-6 rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-indigo-600" />
          <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">{title}</h4>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed text-justify whitespace-pre-wrap">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 text-xs text-slate-700 leading-relaxed">
      <p className="font-semibold mb-1">Narrative</p>
      {fallbackContent}
    </div>
  );
};
