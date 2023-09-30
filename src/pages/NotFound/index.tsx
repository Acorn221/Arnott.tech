import { Link } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import { useEffect } from 'react';
import ReactGA from 'react-ga4';
// The 404 not found page, with tailwind styling
const NotFound = () => {
  useEffect(() => {
    ReactGA.initialize('G-WW6JYGLDCW');
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname, title: document.title });
  });
  return (
    <div className="justify-center h-[50vh] align-bottom flex">
      <div className="m-auto text-white bg-zinc-800/75 rounded-2xl p-5">
        <h1>404 Not Found</h1>
        <p>
          The page you are looking for does not exist. :(
        </p>
        { /* Link to go back home */}
        <Link to="/" className="p-5 flex justify-center align-middle bg-zinc-600 cursor-pointer rounded-2xl gap-5 m-5">
          <FaHome className="h-16 w-16" />
          <span className="m-1 text-center align-middle flex">
            <div className="m-auto text-5xl">Home</div>
          </span>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
