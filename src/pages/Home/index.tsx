import { XyzTransition } from '@animxyz/react';
import { AiFillLinkedin } from 'react-icons/ai';
import { MdEmail } from 'react-icons/md';
import { SiGmail } from 'react-icons/si';
import { useCallback, useEffect, useState } from 'react';
import ReactGA from 'react-ga4';
import Text from '@/misc/Text';
import Carousel from './Carousel';
import Frontend from './Carousel/Slides/Frontend';
import DevTools from './Carousel/Slides/DevTools';
import Backend from './Carousel/Slides/Backend';
import OtherPrograms from './Carousel/Slides/OtherPrograms';
import Projects from './Projects';
import { getEmail } from './util/misc';
import StyledToolTip from '@/misc/StyledComponents/StyledToolTip';
import FidgetSpinner from './Fidget-Spinner';
import { useUnlock } from '../../contexts/UnlockContext';

const txt = Text.home;

const fadeAnimation = 'fade in-out delay-4 duration-24';

const slides = [
  Frontend,
  Backend,
  DevTools,
  OtherPrograms,
];

const Home = () => {
  const [email, setEmail] = useState('/');
  const { unlockState } = useUnlock();

  const requestEmail = useCallback(() => {
    if (!unlockState.emailUnlocked) {
      return '🔒 Spin the fidget spinner 200 times to unlock!';
    }
    const unencryptedEmail = getEmail();
    setEmail(unencryptedEmail);
    return unencryptedEmail;
  }, [unlockState.emailUnlocked]);

  useEffect(() => {
    ReactGA.initialize('G-WW6JYGLDCW');
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname, title: document.title });

    requestEmail();
  });

  const getGmailLink = () => `https://mail.google.com/mail/u/0/?fs=1&to=${encodeURIComponent(requestEmail())}&su=I'm%20here%20from%20a.rno.tt!&tf=cm`;

  const scrollToSpinner = useCallback(() => {
    const spinnerElement = document.querySelector('canvas');
    if (spinnerElement) {
      spinnerElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, []);

  const handleGmailLinkClick = useCallback(() => {
    if (!unlockState.emailUnlocked) {
      scrollToSpinner();
      return;
    }
    ReactGA.send({
      category: 'UrlClick', action: 'gmail-click', page: window.location.pathname, title: document.title,
    });
    window.open(getGmailLink());
  }, [email, unlockState.emailUnlocked, scrollToSpinner]);

  const handleLinkedInLinkClick = useCallback(() => {
    if (!unlockState.linkedinUnlocked) {
      scrollToSpinner();
      return;
    }
    ReactGA.send({
      category: 'UrlClick', action: 'linkedin-click', page: window.location.pathname, title: document.title,
    });
    window.open('https://www.linkedin.com/in/james-arnott-341705143/');
  }, [email, unlockState.linkedinUnlocked, scrollToSpinner]);

  const handleEmailLinkClick = useCallback(() => {
    if (!unlockState.emailUnlocked) {
      scrollToSpinner();
      return;
    }
    ReactGA.send({
      category: 'UrlClick', action: 'email-click', page: window.location.pathname, title: document.title,
    });
    window.open(`mailto:${requestEmail()}`);
  }, [email, unlockState.emailUnlocked, scrollToSpinner]);

  return (
    <div className="h-full text-white">
      <XyzTransition appear xyz={`${fadeAnimation} down-2`}>
        <div className="text-5xl text-center py-5 h-[10vh] min-h-[2em] min-w-fit">
          {txt.title}
        </div>
      </XyzTransition>
      <XyzTransition appear xyz={`${fadeAnimation} up-2`}>
        <div>
          <Carousel className="h-[35vh] min-h-[5em]">
            {
            slides.map((Slide, index) => (
              <Slide index={index} />
            ))
          }
          </Carousel>
        </div>
      </XyzTransition>

      <div className="flex justify-center">
        {/* <XyzTransition appear xyz={`${fadeAnimation} down-2 short-100%`}> */}
        <div className="min-h-[5em] flex flex-col align-middle justify-center gap-4 max-w-[1280px]">
          <div className="flex-col flex gap-4 text-center">
            <div className="flex flex-col lg:flex-row gap-4">
              <FidgetSpinner className="flex-1 lg:h-96 lg:min-h-full w-full min-h-[40vh] select-none" />
              <XyzTransition appear xyz={`${fadeAnimation} down-2 short-100%`}>
                <div className="flex-1 px-5">
                  <div className="text-3xl p-2 bg-zinc-800/75 rounded-xl ">
                    {txt.intro.title}
                    <div className="bg-white p-[2px] rounded-full mt-1" />
                  </div>
                  <div className="md:text-2xl text-xl p-5 bg-zinc-800/75 rounded-xl">
                    {txt.intro.text}
                  </div>
                </div>
              </XyzTransition>
            </div>

            <div className="text-3xl p-2 bg-zinc-800/75 rounded-xl">
              {txt.projects.title}
              <div className="bg-white p-[2px] rounded-full mt-1" />
            </div>
            <Projects />
            <div className="rounded-xl bg-zinc-800/75 p-5 flex-col flex">
              <div className="underline text-center text-3xl">
                {txt.contactMe.title}
              </div>
              <div className="flex w-full text-center justify-center m-2">
                <div onClick={() => handleLinkedInLinkClick()} className={`flex-1 justify-center ${!unlockState.linkedinUnlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <StyledToolTip placement="top" arrow title={unlockState.linkedinUnlocked ? "James-Arnott-341705143" : "🔒 Spin the fidget spinner 100 times to unlock!"}>
                    <div className="m-auto w-[15vmin] flex-col flex relative">
                      <AiFillLinkedin className={`w-[15vmin] h-full m-auto ${unlockState.linkedinUnlocked ? 'text-blue-500' : 'text-gray-500'}`} />
                      {!unlockState.linkedinUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-3xl">🔒</div>
                        </div>
                      )}
                      <div>
                        {txt.contactMe.linkedIn.text}
                        {!unlockState.linkedinUnlocked && ' 🔒'}
                      </div>
                    </div>
                  </StyledToolTip>
                </div>

                <div onClick={() => handleEmailLinkClick()} className={`flex-1 justify-center ${!unlockState.emailUnlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <StyledToolTip placement="top" arrow title={unlockState.emailUnlocked ? requestEmail() : "🔒 Spin the fidget spinner 200 times to unlock!"}>
                    <div className="m-auto w-[15vmin] flex-col flex relative">
                      <MdEmail className={`w-[15vmin] h-full m-auto ${unlockState.emailUnlocked ? 'text-red-500' : 'text-gray-500'}`} />
                      {!unlockState.emailUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-3xl">🔒</div>
                        </div>
                      )}
                      <div>
                        {txt.contactMe.email.text}
                        {!unlockState.emailUnlocked && ' 🔒'}
                      </div>
                    </div>
                  </StyledToolTip>
                </div>

                <div onClick={() => handleGmailLinkClick()} className={`flex-1 justify-center ${!unlockState.emailUnlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <StyledToolTip placement="top" arrow title={unlockState.emailUnlocked ? requestEmail() : "🔒 Spin the fidget spinner 200 times to unlock!"}>
                    <div className="m-auto w-[15vmin] flex-col flex relative">
                      <SiGmail className={`w-[15vmin] h-full m-auto ${unlockState.emailUnlocked ? 'text-red-500' : 'text-gray-500'}`} />
                      {!unlockState.emailUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-3xl">🔒</div>
                        </div>
                      )}
                      <div>
                        {txt.contactMe.gmail.text}
                        {!unlockState.emailUnlocked && ' 🔒'}
                      </div>
                    </div>
                  </StyledToolTip>
                </div>

              </div>
            </div>
          </div>
        </div>
        {/* </XyzTransition> */}
      </div>

    </div>

  );
};

export default Home;
