import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          className,
        )}
        ref={ref}
        {...props}
      />
      <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground pointer-events-none select-none">
        ⟛ resize
      </span>
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
