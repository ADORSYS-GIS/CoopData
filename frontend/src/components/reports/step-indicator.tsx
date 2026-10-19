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
    <ol className="flex items-start gap-2 mb-4">
      {steps.map((st, idx) => {
        const active = currentStepIndex === idx;
        const done = currentStepIndex > idx;
        return (
          <li
            key={st.key}
            className="flex-1 flex items-start gap-2 min-w-0"
            aria-current={active ? "step" : undefined}
          >
            <div className="flex flex-col items-center gap-1 min-w-0">
              <StepDot n={idx + 1} active={active} done={done} />
              <span
                className={`text-[10px] font-semibold text-center leading-tight ${
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {st.label}
              </span>
            </div>
            {idx < steps.length - 1 && <div className="mt-3 h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
