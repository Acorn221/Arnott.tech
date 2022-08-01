import { XyzTransitionGroup } from '@animxyz/react';

import React, { useContext, useEffect, useState } from 'react';
import { OtherProgramsIcons } from '../util/Icons';
import { CaroselContext } from '@/pages/Home/Carosel/';
import Text from '@/misc/Text';
import Slide from '../Slide';
import IconContainer from '../util/IconContainer';

const txt = Text.home.slides.otherPrograms;

const iconStyles = 'h-[12vmin] max-h-[8vh]';

const OtherPrograms = ({ index }: {index: number}) => {
  const currentSlide = useContext(CaroselContext);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!seen) {
      if (currentSlide === index) {
        setSeen(true);
      }
    }
  }, [currentSlide]);

  return (
    <Slide className="bg-gradient-to-r from-yellow-700 to-red-700 text-white text-3xl">
      <div className="flex w-full h-full md:flex-row flex-col-reverse">
        <div className="flex-auto h-full flex justify-center align-middle">
          {seen && (
          <XyzTransitionGroup appear xyz="fade flip-up flip-left delay-5 stagger" className="m-auto brightness-0 invert grid grid-cols-4 md:p-10 gap-4">
            { /* Unfortunatley there is a glitch with the animXYZ animation library, and the div parents have to be in this component */}
            {
              OtherProgramsIcons.map((icon) => (
                <div>
                  <IconContainer icon={icon.icon} tooltipText={icon.tooltipText} iconStyles={iconStyles} />
                </div>
              ))
            }
          </XyzTransitionGroup>
          )}
        </div>

        <div className="md:flex-1 flex-none align-middle m-auto">
          <div className="p-3 mr-6 md:mr-12 text-xl md:text-3xl">{txt.text}</div>
        </div>
      </div>
    </Slide>
  );
};

export default OtherPrograms;
