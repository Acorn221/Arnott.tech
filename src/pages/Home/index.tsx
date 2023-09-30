import { XyzTransition } from '@animxyz/react';
import { AiFillLinkedin } from 'react-icons/ai';
import { MdEmail } from 'react-icons/md';
import { SiGmail } from 'react-icons/si';
import { useEffect, useState } from 'react';
import ReactGA from 'react-ga4';
import Text from '@/misc/Text';
import Carosel from './Carosel';
import Frontend from './Carosel/Slides/Frontend';
import DevTools from './Carosel/Slides/DevTools';
import Backend from './Carosel/Slides/Backend';
import OtherPrograms from './Carosel/Slides/OtherPrograms';
import Projects from './Projects';
import { getEmail } from './util/misc';
import StyledToolTip from '@/misc/StyledComponents/StyledToolTip';

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

  useEffect(() => {
    ReactGA.initialize('G-WW6JYGLDCW');
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname, title: document.title });
  });

  const requestEmail = () => {
    setEmail(getEmail());
    return email;
  };

  const getGmailLink = () => {
    requestEmail();
    return `https://mail.google.com/mail/u/0/?fs=1&to=${encodeURIComponent(email)}&su=I'm%20here%20from%20J4A.uk!&tf=cm`;
  };

  const handleGmailLinkClick = () => {
    ReactGA.send({
      category: 'UrlClick', action: 'gmail-click', page: window.location.pathname, title: document.title,
    });
    window.open(getGmailLink());
  };

  const handleLinkedInLinkClick = () => {
    ReactGA.send({
      category: 'UrlClick', action: 'linkedin-click', page: window.location.pathname, title: document.title,
    });
    window.open('https://www.linkedin.com/in/james-arnott-341705143/');
  };

  const handleEmailLinkClick = () => {
    ReactGA.send({
      category: 'UrlClick', action: 'email-click', page: window.location.pathname, title: document.title,
    });
    window.open(`mailto:${requestEmail()}`);
  };

  return (
    <div className="h-full text-white">
      <XyzTransition appear xyz={`${fadeAnimation} down-2`}>
        <div className="text-5xl text-center py-5 h-[10vh] min-h-[2em] min-w-fit">
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
            <div className="flex-col flex gap-4 text-center">
              <div className="text-3xl p-2 bg-zinc-800/75 rounded-xl">
                {txt.intro.title}
                <div className="bg-white p-[2px] rounded-full mt-1" />
              </div>
              <div className="md:text-2xl text-xl p-5 bg-zinc-800/75 rounded-xl">
                {txt.intro.text}
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
                  <div className="flex-1 justify-center" onClick={() => handleLinkedInLinkClick()}>
                    <StyledToolTip placement="top" arrow title="James-Arnott-341705143">
                      <div className="m-auto w-[15vmin] flex-col flex">
                        <AiFillLinkedin className="w-[15vmin] h-full m-auto" />
                        <div>
                          {txt.contactMe.linkedIn.text}
                        </div>
                      </div>
                    </StyledToolTip>
                  </div>

                  <div onClick={() => handleEmailLinkClick()} className="flex-1 justify-center ">
                    <StyledToolTip placement="top" arrow onOpen={() => requestEmail()} title={email}>
                      <div className="m-auto w-[15vmin] flex-col flex">
                        <MdEmail className="w-[15vmin] h-full cursor-pointer m-auto" />
                        <div>
                          {txt.contactMe.email.text}
                        </div>
                      </div>
                    </StyledToolTip>
                  </div>

                  <div onClick={() => handleGmailLinkClick()} className="flex-1 justify-center ">
                    <StyledToolTip placement="top" arrow onOpen={() => requestEmail()} title={email}>
                      <div className="m-auto w-[15vmin] flex-col flex">
                        <SiGmail className="w-[15vmin] h-full cursor-pointer m-auto" />
                        <div>
                          {txt.contactMe.gmail.text}
                        </div>
                      </div>
                    </StyledToolTip>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </XyzTransition>
      </div>

    </div>

  );
};

export default Home;
