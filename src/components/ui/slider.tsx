import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  smoothSnap?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, smoothSnap = true, value, onValueChange, step = 1, min = 0, max = 100, ...props }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(value || [min]);

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleValueChange = (newValue: number[]) => {
    setInternalValue(newValue);
    if (!smoothSnap) {
      onValueChange?.(newValue);
    }
  };

  const handleValueCommit = (newValue: number[]) => {
    const snappedValue = newValue.map(v => Math.round(v / step) * step);
    setInternalValue(snappedValue);
    onValueChange?.(snappedValue);
    setIsDragging(false);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={internalValue}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      onPointerDown={() => setIsDragging(true)}
      step={smoothSnap && isDragging ? 0.1 : step}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range 
          className={cn(
            "absolute h-full bg-primary",
            smoothSnap && !isDragging && "transition-all duration-200 ease-out"
          )} 
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing",
          smoothSnap && !isDragging && "transition-all duration-200 ease-out"
        )} 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
