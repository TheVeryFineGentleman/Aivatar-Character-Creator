import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
  emoji?: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, options, placeholder, className, id, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            "field-input appearance-none pr-10 cursor-pointer",
            "[&>option]:bg-ink-800 [&>option]:text-ink-50",
            className,
          )}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.emoji ? `${opt.emoji}  ${opt.label}` : opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-50/40 pointer-events-none" />
      </div>
      {hint && <p className="text-xs text-ink-50/40 mt-1.5">{hint}</p>}
    </div>
  );
});
