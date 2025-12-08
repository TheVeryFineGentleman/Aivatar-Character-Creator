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
  const [isDragging, setIsDragging] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(value || [min as number]);
  
  const lockedPercentage = lockedStart !== undefined 
    ? ((lockedStart - (min as number)) / ((max as number) - (min as number))) * 100 
    : undefined;

  // Sync display value with external value when not dragging
  React.useEffect(() => {
    if (!isDragging && value) {
      setDisplayValue(value);
    }
  }, [value, isDragging]);

  const handleValueChange = (newValue: number[]) => {
    setDisplayValue(newValue);
    if (!isDragging) {
      onValueChange?.(newValue);
    }
  };

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Snap to nearest step on release
      const snappedValue = displayValue.map(v => 
        Math.round(v / (step as number)) * (step as number)
      );
      setDisplayValue(snappedValue);
      onValueChange?.(snappedValue);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
      return () => {
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    }
  }, [isDragging, displayValue]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      min={min}
      max={max}
      step={isDragging ? 0.1 : step}
      value={displayValue}
      onValueChange={handleValueChange}
      onPointerDown={handlePointerDown}
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
        className={cn(
          "block h-6 w-6 rounded-full bg-[#0a0a0a] border-[3px] border-primary shadow-lg outline-none cursor-grab active:cursor-grabbing",
          !isDragging && "transition-[left] duration-150 ease-out"
        )}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
