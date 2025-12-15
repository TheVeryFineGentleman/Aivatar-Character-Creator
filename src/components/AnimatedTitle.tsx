import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

type TitleLayout = {
  width: number;
  offsets: number[];
};

export const AnimatedTitle = ({ text, className = "" }: AnimatedTitleProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState<TitleLayout | null>(null);

  const chars = useMemo(() => text.split(""), [text]);

  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const measure = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const width = wrapperRect.width || 1;
      const offsets = chars.map((_, i) => {
        const node = charRefs.current[i];
        if (!node) return 0;
        const r = node.getBoundingClientRect();
        return r.left - wrapperRect.left;
      });
      setLayout({ width, offsets });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [chars]);

  return (
    <span ref={wrapperRef} className={`inline-flex ${className}`} aria-label={text}>
      {chars.map((char, index) => (
        <span
          key={index}
          ref={(node) => {
            charRefs.current[index] = node;
          }}
          className="inline-block transition-all duration-500 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
            transitionDelay: `${index * 40}ms`,
            backgroundSize: layout ? `${layout.width}px 100%` : undefined,
            backgroundPosition: layout ? `${-layout.offsets[index]}px 0%` : undefined,
            backgroundRepeat: "no-repeat",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
};

