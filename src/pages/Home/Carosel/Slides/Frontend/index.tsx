import { XyzTransitionGroup } from '@animxyz/react';

import TailwindCss from 'devicon/icons/tailwindcss/tailwindcss-plain.svg';
import ReactIcon from 'devicon/icons/react/react-original.svg';
import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import JestIcon from 'devicon/icons/jest/jest-plain.svg';
import MaterialUiIcon from 'devicon/icons/materialui/materialui-original.svg';
import ReduxIcon from 'devicon/icons/redux/redux-original.svg';
import { useContext, useEffect, useState } from 'react';
import { CaroselContext } from '@/pages/Home/Carosel/';
import Text from '@/misc/Text';
import Slide from '../Slide';
import IconContainer from '../util/IconContainer';

const txt = Text.home.slides.frontend;

interface IconInterface {
  icon: string;
  tooltipText: string;
}

/**
 * The icons array,
 * which contains the icons to be displayed in the carosel.
 * There is no need for translation with these names.
 */
const icons: IconInterface[] = [
  {
    icon: TypeScriptIcon,
    tooltipText: 'TypeScript',
  },
  {
    icon: JavascriptIcon,
    tooltipText: 'Javascript',
  },
  {
    icon: ReactIcon,
    tooltipText: 'React',
  },
  {
    icon: MaterialUiIcon,
    tooltipText: 'Material-UI',
  },
  {
    icon: ReduxIcon,
    tooltipText: 'Redux',
  },
  {
    icon: JestIcon,
    tooltipText: 'Jest',
  },
];

interface FrontendInterface {
  index: number;
}

const Frontend = ({ index }: FrontendInterface) => {
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
              icons.map((icon) => (
                <div>
                  <IconContainer icon={icon.icon} tooltipText={icon.tooltipText} />
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

export default Frontend;
