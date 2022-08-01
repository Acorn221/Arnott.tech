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
    <XyzTransition appear xyz={`${fadeAnimation} down-2 short-100%`}>
      <div className="min-h-[5em] grid 2xl:grid-cols-3 md:grid-cols-2 grid-cols-1 align-middle justify-center gap-4 p-5">
        {
          txt.boxes.map((box) => (
            <div key={Math.random()} className="text-2xl text-center text-white bg-slate-700 p-5 rounded-xl md:max-w-[45vw] order-2">
              {box}
            </div>
          ))
        }
      </div>
    </XyzTransition>
  </div>

);

export default Home;
