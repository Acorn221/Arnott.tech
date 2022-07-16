/* eslint-disable react/require-default-props */
import { ReactNode } from 'react';

type SlideProps = {
	className?: string;
  children?: ReactNode;
};

const Slide = ({
  className,
  children,
}: SlideProps) => (
  <div className={`keen-slider__slide text-center flex w-full items-center min-h-[30vh] bg-slate-400 ${className}`}>
    <div className="m-auto">{children}</div>
  </div>
);

export default Slide;
