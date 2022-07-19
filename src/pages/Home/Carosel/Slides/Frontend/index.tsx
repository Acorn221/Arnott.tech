import { XyzTransitionGroup } from '@animxyz/react';

import TailwindCss from 'devicon/icons/tailwindcss/tailwindcss-plain.svg';
import ReactIcon from 'devicon/icons/react/react-original.svg';
import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import JestIcon from 'devicon/icons/jest/jest-plain.svg';
import MaterialUiIcon from 'devicon/icons/materialui/materialui-original.svg';
import ReduxIcon from 'devicon/icons/redux/redux-original.svg';

import { MouseEventHandler } from 'react';
import Text from '@/misc/Text';
import Slide from '../Slide';

const txt = Text.home.slides.frontend;

const iconVh = '8vh';

const iconStyles = `h-[${iconVh}]`;

const Frontend = () => (
  <Slide className="bg-gradient-to-r from-yellow-700 to-red-700 text-white text-3xl">
    <div className="flex w-full h-full">
      <div className="flex-1 h-full flex justify-center align-middle ">
        <XyzTransitionGroup appear xyz="fade flip-up flip-left delay-5 stagger" className="m-auto brightness-0 invert grid grid-cols-4 gap-2 ">
          <img src={TypeScriptIcon} className={iconStyles} />
          <img src={JavascriptIcon} className={iconStyles} />
          <img src={ReactIcon} className={iconStyles} />
          <img src={TailwindCss} className={iconStyles} />
          <img src={ReduxIcon} className={iconStyles} />
          <img src={MaterialUiIcon} className={iconStyles} />
          <img src={JestIcon} className={iconStyles} />
        </XyzTransitionGroup>
      </div>

      <div className="flex-1 align-middle m-auto">
        <div className="p-3 mr-6 md:mr-12 text-xl md:text-3xl">{txt.text}</div>
      </div>
    </div>
  </Slide>
);

export default Frontend;
