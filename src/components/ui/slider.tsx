import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  lockedStart?: number;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, lockedStart, min = 0, max = 100, ...props }, ref) => {
  const lockedPercentage = lockedStart !== undefined 
    ? ((lockedStart - (min as number)) / ((max as number) - (min as number))) * 100 
    : undefined;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
        {/* Red locked area inside the track */}
        {lockedPercentage !== undefined && (
          <div 
            className="absolute h-full bg-red-500/50 pointer-events-none"
            style={{ 
              left: `${lockedPercentage}%`,
              right: '0'
            }}
          />
        )}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        style={{ backgroundColor: '#0a0a0a' }} 
        className="block h-5 w-5 rounded-full border-2 border-primary shadow-lg focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
