import { XyzTransitionGroup } from '@animxyz/react';
import { useContext, useEffect, useState } from 'react';
import { CaroselContext } from '@/pages/Home/Carosel/';
import Text from '@/misc/Text';
import Slide from '../Slide';
import IconContainer from '../util/IconContainer';
import { BackendIcons } from '../util/Icons';

const txt = Text.home.slides.backend;

const iconStyles = 'h-[9vmin] max-h-[8vmin] min-h-[6vmin]';

const Backend = ({ index }: {index: number}) => {
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
        <div className="md:flex-1 flex-2 h-full flex justify-center align-middle">
          {seen && (
          <XyzTransitionGroup appear xyz="fade flip-up flip-left delay-5 stagger" className="m-auto brightness-0 invert grid grid-cols-4 gap-2 md:p-auto p-1">
            {
              BackendIcons.map((icon) => (
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

export default Backend;
