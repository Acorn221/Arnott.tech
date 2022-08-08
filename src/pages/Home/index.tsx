import { XyzTransition } from '@animxyz/react';
import Text from '@/misc/Text';
import Carosel from './Carosel';
import Frontend from './Carosel/Slides/Frontend';
import DevTools from './Carosel/Slides/DevTools';
import Backend from './Carosel/Slides/Backend';
import OtherPrograms from './Carosel/Slides/OtherPrograms';

const txt = Text.home;

const fadeAnimation = 'fade in-out delay-4 duration-24';

const slides = [
  Frontend,
  Backend,
  DevTools,
  OtherPrograms,
];

const Home = () => (
  <div className="h-full">
    <XyzTransition appear xyz={`${fadeAnimation} down-2`}>
      <div className="text-5xl text-center py-5 text-white h-[10vh] min-h-[2em] min-w-fit">
        {txt.title}
      </div>
    </XyzTransition>
    <XyzTransition appear xyz={`${fadeAnimation} up-2`}>
      <div>
        <Carosel className="h-[35vh] min-h-[5em]">
          {
            slides.map((Slide, index) => (
              <Slide index={index} />
            ))
          }
        </Carosel>
      </div>
    </XyzTransition>
    <div className="flex justify-center">
      <XyzTransition appear xyz={`${fadeAnimation} down-2 short-100%`}>
        <div className="min-h-[5em] flex flex-col align-middle justify-center gap-4 p-5 max-w-[1280px]">
          <div className="text-white flex-col flex gap-4 text-center">
            <div className="text-3xl p-2 bg-slate-600 rounded-xl">
              {txt.intro.title}
              <div className="bg-white p-[2px] rounded-full" />
            </div>
            <div className="text-2xl p-5 bg-slate-700 rounded-xl">
              {txt.intro.text}
            </div>
          </div>
        </div>
      </XyzTransition>
    </div>

  </div>

);

export default Home;
