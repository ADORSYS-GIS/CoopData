import React from "react";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/app-shell";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
}

interface WizardLayoutProps {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  currentStepIndex: number;
  completedSteps: string[];
  totalFields: number;
  completedFields: number;
  onStepChange: (index: number) => void;
  children: React.ReactNode;
  isSubmitting?: boolean;
  isEditing?: boolean;
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  title,
  subtitle,
  steps,
  currentStepIndex,
  completedSteps,
  totalFields,
  completedFields,
  onStepChange,
  children,
  isSubmitting = false,
  isEditing = false,
}) => {
  const progressPercent = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  return (
    <Card title={title} subtitle={subtitle}>
      <div className="flex flex-col md:flex-row gap-6 p-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 border-r border-border/50 pr-6">
          <div className="mb-6">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Overall Progress
            </h4>
            <div className="flex items-center justify-between text-sm font-semibold mb-1">
              <span>{progressPercent}% Complete</span>
              <span className="text-muted-foreground font-normal">
                {completedFields} / {totalFields} fields
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <nav className="space-y-1">
            {steps.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              const isCompleted = completedSteps.includes(step.id);
              const isClickable = isEditing || isCompleted || index <= currentStepIndex; // Can navigate back or to completed, or any if editing

              return (
                <button
                  key={step.id}
                  onClick={() => isClickable && onStepChange(index)}
                  disabled={!isClickable}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : isClickable
                        ? "hover:bg-muted text-foreground"
                        : "opacity-50 cursor-not-allowed text-muted-foreground"
                  }`}
                >
                  <div
                    className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCompleted && !isCurrent
                        ? "bg-success text-success-foreground"
                        : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {isCompleted && !isCurrent ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight">{step.title}</div>
                    {step.description && (
                      <div className="text-xs mt-0.5 opacity-80">{step.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            {isSubmitting && (
              <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const WizardSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="mb-8 last:mb-0">
    <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-4">
      {title}
    </h3>
    <div className="space-y-5">{children}</div>
  </div>
);

export const WizardRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
);
