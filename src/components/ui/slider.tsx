import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'onValueChange'> {
  lockedStart?: number;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, lockedStart, min = 0, max = 100, step = 1, value, onValueChange, ...props }, ref) => {
  const lockedPercentage = lockedStart !== undefined 
    ? ((lockedStart - (min as number)) / ((max as number) - (min as number))) * 100 
    : undefined;

  const handleValueChange = (newValue: number[]) => {
    // Snap to integer when very close (within 0.15 of an integer)
    const snappedValue = newValue.map(v => {
      const nearestInt = Math.round(v);
      const distance = Math.abs(v - nearestInt);
      if (distance < 0.15) {
        return nearestInt;
      }
      return v;
    });
    onValueChange?.(snappedValue);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      min={min}
      max={max}
      step={0.05}
      value={value}
      onValueChange={handleValueChange}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-secondary/80 cursor-pointer">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
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
        className="block h-5 w-5 rounded-full bg-[#0a0a0a] border-2 border-primary shadow-lg outline-none cursor-grab active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
