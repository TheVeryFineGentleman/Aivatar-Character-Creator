import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, onValueChange, step = 1, min = 0, max = 100, ...props }, ref) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleValueChange = (newValue: number[]) => {
    // Show rounded value live during drag
    const roundedValue = newValue.map(v => Math.round(v / step) * step);
    onValueChange?.(roundedValue);
  };

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  const handlePointerUp = () => {
    // Small delay to allow the snap animation to play
    setTimeout(() => setIsDragging(false), 50);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerUp = () => handlePointerUp();
      window.addEventListener('pointerup', handleGlobalPointerUp);
      return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
    }
  }, [isDragging]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      onValueChange={handleValueChange}
      onPointerDown={handlePointerDown}
      step={step}
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
          "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing",
          !isDragging && "transition-all duration-200 ease-out"
        )} 
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
