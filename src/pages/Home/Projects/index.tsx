import { XyzTransition } from '@animxyz/react';
import { AiFillGithub, AiFillChrome } from 'react-icons/ai';
import { ImFirefox } from 'react-icons/im';
import { BiLinkExternal } from 'react-icons/bi';
import ReactGA from 'react-ga4';
import Text from '@/misc/Text';

const txt = Text.home.projects;

const openLink = (link: string) => {
  ReactGA.send({
    category: 'UrlClick', action: 'project-link', url: link,
  });
  window.open(link, '_blank');
};

const Projects = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {txt.arr.map((project) => (
      <div className="flex flex-col bg-zinc-800/75 rounded-2xl">
        {
    project.photo && (
      <XyzTransition appear xyz="fade in-out delay-8">
        <img src={project.photo} alt={project.title} className="w-64 mx-auto p-4" />
      </XyzTransition>
    )
    }
        <div className="text-3xl m-2">
          {project.title}
        </div>
        <div className="flex justify-center align-middle">
          <div className="bg-white p-[2px] rounded-full w-9/12 mt-1 m-auto" />
        </div>
        <div className="md:text-2xl text-xl m-3 flex-1">
          {project.text}
        </div>
        <div className="flex justify-center align-middle p-4 gap-4">
          {
            project.links && project.links.map((link) => {
              let content;
              const iconStyles = 'h-14 w-14 m-auto';
              switch (link.type) {
                case 'github':
                  content = (<AiFillGithub className={iconStyles} />);
                  break;
                case 'chrome-web-store':
                  content = (<AiFillChrome className={iconStyles} />);
                  break;
                case 'firefox-web-store':
                  content = (<ImFirefox className={iconStyles} />);
                  break;
                case 'hosted':
                  content = (<BiLinkExternal className={iconStyles} />);
                  break;
                default:
                  return link.type;
              }

              return (
                <div className="btn btn-circle btn-ghost flex justify-center align-middle h-20 w-20" onClick={() => openLink(link.url)}>
                  {content}
                </div>
              );
            })
          }
        </div>
      </div>
    ))}
  </div>
);

export default Projects;
