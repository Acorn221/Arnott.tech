import { type ReactNode } from "react";

interface SlideProps {
  className?: string;
  children?: ReactNode;
}

export const Slide = ({ className, children }: SlideProps) => (
  <div
    className={`keen-slider__slide text-center flex w-full items-center min-h-[30vh] ${className}`}
  >
    {children}
  </div>
);
