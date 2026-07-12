/**
 * Word-by-word fade-in title. Pure CSS animation via staggered delays — no JS RAF.
 */
import { useMemo } from "react";
import { cn } from "@/lib/cn";

interface Props {
  text: string;
  highlightFrom?: number; // index of first word to render as gradient
  className?: string;
  as?: "h1" | "h2" | "h3";
}

export function AnimatedTitle({ text, highlightFrom, className, as = "h1" }: Props) {
  const words = useMemo(() => text.split(/\s+/), [text]);
  const Tag = as as keyof JSX.IntrinsicElements;

  return (
    <Tag className={cn("font-semibold tracking-tight leading-[1.05]", className)}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className={cn(
            "inline-block opacity-0 animate-word-in",
            highlightFrom !== undefined && i >= highlightFrom && "grad-text",
          )}
          style={{ animationDelay: `${i * 80}ms`, marginRight: "0.25em" }}
        >
          {w}
        </span>
      ))}
    </Tag>
  );
}
