import { useState, useEffect } from "react";

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

export const AnimatedTitle = ({ text, className = "" }: AnimatedTitleProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <span className={`inline-flex ${className}`}>
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="inline-block transition-all duration-500 text-primary"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
            transitionDelay: `${index * 40}ms`,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
};
