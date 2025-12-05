import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    onValueCommit?: (value: number[]) => void;
  }
>(({ className, value, onValueChange, onValueCommit, step = 1, min = 0, max = 100, ...props }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value || [min]);

  React.useEffect(() => {
    if (!isDragging && value) {
      setInternalValue(value);
    }
  }, [value, isDragging]);

  const handleValueChange = (newValue: number[]) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handlePointerUp = () => {
        setIsDragging(false);
        // Snap to nearest step on release
        const snappedValue = internalValue.map(v => Math.round(v / step) * step);
        setInternalValue(snappedValue);
        onValueChange?.(snappedValue);
        onValueCommit?.(snappedValue);
      };
      window.addEventListener('pointerup', handlePointerUp);
      return () => window.removeEventListener('pointerup', handlePointerUp);
    }
  }, [isDragging, internalValue, step, onValueChange, onValueCommit]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={internalValue}
      onValueChange={handleValueChange}
      onPointerDown={handlePointerDown}
      step={isDragging ? 0.01 : step}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range 
          className={cn(
            "absolute h-full bg-primary",
            !isDragging && "transition-all duration-200 ease-out"
          )} 
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-5 w-5 rounded-full bg-black border-2 border-primary shadow-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing",
          !isDragging && "transition-all duration-200 ease-out"
        )} 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
