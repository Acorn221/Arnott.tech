/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
import React, { useEffect, useState } from 'react';
import { useKeenSlider } from 'keen-slider/react';
import './carosel.css';
import 'keen-slider/keen-slider.min.css';
import Arrow from './Arrow';

export interface CaroselProps {
  children: React.ReactNode;
  className?: string;
  slideContainerClass?: string;
}

const Carosel = ({ children, className, slideContainerClass }: CaroselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastChanged, setLastChanged] = useState(Date.now());
  const [nextSlideTimeout, setnextSlideTimeout] = useState(0);
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: true,
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
      setLastChanged(Date.now());
    },
    created() {
      setLoaded(true);
    },
  });

  // allow the user to use arrow keys to navigate the carosel
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      instanceRef.current?.prev();
    } else if (e.key === 'ArrowRight') {
      instanceRef.current?.next();
    }
  };

  // set a delay for changing the carosel slide
  useEffect(() => {
    if (nextSlideTimeout) window.clearTimeout(nextSlideTimeout);
    setnextSlideTimeout(window.setTimeout(() => {
      requestAnimationFrame(() => {
        instanceRef.current?.next();
      });
    }, 10000));
  }, [lastChanged]);

  return (
    <div className={className}>
      <div className="navigation-wrapper shadow-2xl">
        <div ref={sliderRef} className={`keen-slider w-full h-[30vh] min-h-[10em] ${slideContainerClass}`} onKeyUp={handleKeyUp} tabIndex={0}>
          {children}
        </div>
        {loaded && instanceRef.current && (
        <>
          <Arrow
            left
            onClick={(e: any) => e.stopPropagation() || instanceRef.current?.prev()}
          />
          <Arrow
            onClick={(e: any) => e.stopPropagation() || instanceRef.current?.next()}
          />
        </>
        )}
      </div>
      {loaded && instanceRef.current && (
      <div className="dots">
        {[
          ...Array(instanceRef.current.track.details.slides.length).keys(),
        ].map((idx) => (
          // eslint-disable-next-line jsx-a11y/control-has-associated-label
          <button
            key={idx}
            onClick={() => {
              instanceRef.current?.moveToIdx(idx);
            }}
            className={`dot${currentSlide === idx ? ' active' : ''}`}
          />
        ))}
      </div>
      )}
    </div>
  );
};

export default Carosel;
