import { useEffect } from 'react';
import ReactGA from 'react-ga4';

const RickRoll = () => {
  useEffect(() => {
    ReactGA.send({
      category: 'UrlClick', action: 'rickroll', page: window.location.pathname, title: document.title,
    });
    window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  });
  return <div>you know the rules and so do i</div>;
};

export default RickRoll;
