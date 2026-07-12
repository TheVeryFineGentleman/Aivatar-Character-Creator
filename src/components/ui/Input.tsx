import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, className, id, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-50/40 pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "field-input",
            iconLeft && "pl-11",
            error && "border-danger/60 focus:border-danger focus:ring-danger/20",
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-xs text-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-50/40 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 4, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={cn(
          "field-input resize-y min-h-24",
          error && "border-danger/60 focus:border-danger focus:ring-danger/20",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-50/40 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
});
