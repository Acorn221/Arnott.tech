import TailwindCss from 'devicon/icons/tailwindcss/tailwindcss-plain.svg';
import ReactIcon from 'devicon/icons/react/react-original.svg';
import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import EslintIcon from 'devicon/icons/eslint/eslint-original.svg';
import MaterialUiIcon from 'devicon/icons/materialui/materialui-original.svg';
import ReduxIcon from 'devicon/icons/redux/redux-original.svg';

import Slide from '../Slide';

const Frontend = () => (
  <Slide className="bg-gradient-to-r from-yellow-700 to-red-700 text-white text-3xl">
    <div className="flex w-full h-full">
      <div className="flex-1 h-full flex justify-center align-middle">
        <div className="m-auto brightness-0 invert grid grid-cols-3 gap-2">
          <img src={TailwindCss} className="h-20" />
          <img src={ReactIcon} className="h-20" />
          <img src={TypeScriptIcon} className="h-20" />
          <img src={JavascriptIcon} className="h-20" />
          <img src={EslintIcon} className="h-20" />
          <img src={MaterialUiIcon} className="h-20" />
          <div />
          <img src={ReduxIcon} className="h-20" />
        </div>
      </div>
      <div className="flex-1 align-middle m-auto">
        <div>hi</div>
      </div>
    </div>
  </Slide>
);

export default Frontend;
