import Text from '@/misc/Text';
import Carosel from './Carosel';
import Frontend from './Carosel/Slides/Frontend';
import Tools from './Carosel/Slides/Tools';

const txt = Text.home;

const Home = () => (
  <div className="h-full">
    <div className="text-5xl text-center py-5 text-white h-[10vh] min-h-[2em] min-w-fit">{txt.title}</div>
    <Carosel className="h-[35vh] min-h-[5em]">
      <Frontend />
      <Tools />
    </Carosel>
    <div className="min-h-[5em] grid 2xl:grid-cols-3 md:grid-cols-2 grid-cols-1 align-middle justify-center gap-4 p-5">
      <div className="text-2xl text-center text-white bg-slate-700 p-5 rounded-xl md:max-w-[45vw] row-span-2">{txt.content}</div>
      <div className="h-[51vh] text-2xl text-center text-white bg-slate-700 p-5 rounded-xl md:max-w-[45vw] order-2">{txt.content}</div>
      <div className="h-[50vh] text-2xl text-center text-white bg-slate-700 p-5 rounded-xl md:max-w-[45vw] order-2">{txt.content}</div>
      <div className="h-[50vh] text-2xl text-center text-white bg-slate-700 p-5 rounded-xl md:max-w-[45vw] order-2">{txt.content}</div>
    </div>
  </div>

);

export default Home;
