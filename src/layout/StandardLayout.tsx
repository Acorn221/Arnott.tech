import { Outlet } from 'react-router';
import { AiFillHeart } from 'react-icons/ai';
import CookieConsent from 'react-cookie-consent';
import Text from '@/misc/Text';

const txt = Text.layout.footer;

const StandardLayout = () => (
  <div className="flex flex-col h-screen justify-between">
    <main>
      <CookieConsent>This website uses cookies for analytics.</CookieConsent>
      <Outlet />
    </main>
    <footer className="sticky top-[100vh]">
      <div className="text-center p-3 bg-gradient-to-r bg-zinc-800/75 outline-4 outline outline-neutral-300  text-white font-semibold z-10">
        {txt.content}
        <AiFillHeart className="fill-red-600 inline align-middle ml-2" />
      </div>
    </footer>
  </div>
);

export default StandardLayout;
