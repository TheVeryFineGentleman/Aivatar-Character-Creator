import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'value' | 'onValueChange'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, value, onValueChange, step = 1, min = 0, max = 100, ...props }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(value || [min]);

  React.useEffect(() => {
    if (!isDragging && value) {
      setDisplayValue(value);
    }
  }, [value, isDragging]);

  const handleValueChange = (newValue: number[]) => {
    setDisplayValue(newValue);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Snap to nearest step
    const snappedValue = displayValue.map(v => Math.round(v / step) * step);
    setDisplayValue(snappedValue);
    onValueChange?.(snappedValue);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={displayValue}
      onValueChange={handleValueChange}
      onPointerDown={() => setIsDragging(true)}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (isDragging) handlePointerUp();
      }}
      step={isDragging ? 0.1 : step}
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
          "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          !isDragging && "transition-all duration-200 ease-out"
        )} 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
