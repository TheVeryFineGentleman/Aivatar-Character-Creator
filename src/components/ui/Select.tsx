import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
  emoji?: string;
  /** Optionale Überschrift. Optionen mit demselben `group`-Text landen unter
   *  einer gemeinsamen `<optgroup>` — in der Reihenfolge ihres Auftretens. */
  group?: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
}

function renderOption(opt: Option) {
  return (
    <option key={opt.value} value={opt.value}>
      {opt.emoji ? `${opt.emoji}  ${opt.label}` : opt.label}
    </option>
  );
}

/** Aufeinanderfolgende Optionen mit gleichem `group` zusammenfassen. Bewusst
 *  reihenfolge-treu statt sortiert: der Aufrufer bestimmt, was zuerst steht. */
function groupOptions(options: Option[]): { group?: string; items: Option[] }[] {
  const blocks: { group?: string; items: Option[] }[] = [];
  for (const opt of options) {
    const last = blocks[blocks.length - 1];
    if (last && last.group === opt.group) last.items.push(opt);
    else blocks.push({ group: opt.group, items: [opt] });
  }
  return blocks;
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
          {groupOptions(options).map((block) =>
            block.group ? (
              <optgroup key={block.group} label={block.group}>
                {block.items.map(renderOption)}
              </optgroup>
            ) : (
              block.items.map(renderOption)
            ),
          )}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-50/40 pointer-events-none" />
      </div>
      {hint && <p className="text-xs text-ink-50/40 mt-1.5">{hint}</p>}
    </div>
  );
});
