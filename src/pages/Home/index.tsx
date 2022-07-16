import Text from '@/misc/Text';
import Carosel from './Carosel';
import Slide from './Carosel/Slide';

const txt = Text.home;

const Home = () => (
  <div className="bg-slate-900">
    <Carosel className="h-[25vh]">
      <Slide className="">
        <div>hi</div>
      </Slide>
      <Slide className="bg-white">
        <div>hi</div>
      </Slide>
    </Carosel>
    <div className=" h-[75vh]">
      <div className="w-screen h-screen grid grid-cols-2 align-middle justify-center ">
        <div className="text-2xl text-center text-white bg-slate-700 m-auto p-5 rounded-xl max-w-[45vw]">{txt.content}</div>
        <div className="text-5xl text-center m-auto text-white">{txt.title}</div>
      </div>
    </div>
  </div>

);

export default Home;
