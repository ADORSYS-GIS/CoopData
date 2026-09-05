import { CheckCircle2 } from "lucide-react";

interface StepDotProps {
  n: number;
  active: boolean;
  done: boolean;
}

export function StepDot({ n, active, done }: StepDotProps) {
  return (
    <div
      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
        done
          ? "bg-primary border-primary text-primary-foreground"
          : active
            ? "bg-primary/10 border-primary text-primary"
            : "bg-muted border-border text-muted-foreground"
      }`}
    >
      {done ? <CheckCircle2 className="size-3.5" /> : n}
    </div>
  );
}

interface StepIndicatorProps {
  steps: Array<{ key: string; label: string }>;
  currentStepIndex: number;
}

export function StepIndicator({ steps, currentStepIndex }: StepIndicatorProps) {
  if (steps.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 mb-4">
      {steps.map((st, idx) => (
        <div key={st.key} className="flex-1 flex items-center gap-2">
          <StepDot n={idx + 1} active={currentStepIndex === idx} done={currentStepIndex > idx} />
          {idx < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}
