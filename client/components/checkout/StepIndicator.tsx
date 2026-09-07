import { cx } from "@/lib/format";

export interface Step {
  id: string;
  label: string;
}

/**
 * Numbered because it genuinely is a sequence. The current step is marked with
 * a brass rule — the accent as a mark, never as text.
 */
export function StepIndicator({
  steps,
  current,
  onGoTo,
}: {
  steps: Step[];
  current: number;
  onGoTo?: (index: number) => void;
}) {
  return (
    <ol className="flex gap-2 md:gap-4">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        const label = (
          <>
            <span className="text-micro text-mist" data-numeric>
              {index + 1}
            </span>
            <span
              className={cx(
                "text-meta",
                active ? "text-ink" : done ? "text-mist" : "text-mist",
              )}
            >
              {step.label}
            </span>
          </>
        );

        return (
          <li key={step.id} className="flex-1">
            <div
              className={cx(
                "h-px w-full",
                active ? "bg-brass" : done ? "bg-ink" : "bg-rule",
              )}
            />
            {done && onGoTo ? (
              <button
                type="button"
                onClick={() => onGoTo(index)}
                className="mt-3 flex min-h-11 items-baseline gap-2 text-left"
              >
                {label}
              </button>
            ) : (
              <div
                className="mt-3 flex min-h-11 items-baseline gap-2"
                aria-current={active ? "step" : undefined}
              >
                {label}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
