// React
import { useEffect, useState } from "react";

// External libraries
import { XyzTransition } from "@animxyz/react";
import ReactGA from "react-ga4";
import { AiFillGithub, AiFillChrome } from "react-icons/ai";
import { BiLinkExternal } from "react-icons/bi";
import { GiArchiveResearch } from "react-icons/gi";
import { ImFirefox } from "react-icons/im";

// Internal modules
import { createLogger } from "@arnott/logger";
import TechStackSlotMachine from "@/components/game/SlotMachine";
import Text from "@/misc/Text";
import { CrashProjectCard } from "../Crash-My-Pc/ProjectCard";

const log = createLogger("ui:projects");

const txt = Text.home.projects;

const openLink = (link: string) => {
  ReactGA.send({
    category: "UrlClick",
    action: "project-link",
    url: link,
  });
  window.open(link, "_blank");
};

const Projects = () => {
  const [referrerSource, setReferrerSource] = useState<string | null>(null);

  useEffect(() => {
    // Get the referrer source from document.referrer
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        const hostname = url.hostname.toLowerCase();
        // Set referrer source to hostname
        setReferrerSource(hostname);
      } catch (e) {
        log.warn("Failed to parse referrer URL", { referrer: document.referrer, error: e });
      }
    }
  }, []);

  // Filter projects based on referrer source
  const filteredProjects = txt.arr.filter((project) => {
    if (!project.hideFromSource || !referrerSource) {
      return true;
    }
    return !project.hideFromSource.includes(referrerSource);
  });

  // Render a single project card
  const renderProjectCard = (
    project: (typeof filteredProjects)[0],
    i: number,
  ) => (
    <div className="flex flex-col bg-zinc-800/75 rounded-2xl" key={i}>
      {project.photo && (
        <XyzTransition appear xyz="fade in-out delay-8">
          <img
            src={project.photo}
            alt={project.title}
            className="w-64 mx-auto p-4"
          />
        </XyzTransition>
      )}
      <div className="text-3xl m-2">{project.title}</div>
      <div className="flex justify-center align-middle">
        <div className="bg-white p-[2px] rounded-full w-9/12 mt-1 m-auto" />
      </div>
      <div className="md:text-2xl text-xl m-3 flex-1">{project.text}</div>
      <div className="flex justify-center align-middle p-4 gap-4">
        {project.links?.map((link, linkIndex) => {
          let content;
          const iconStyles = "h-14 w-14 m-auto";
          switch (link.type) {
            case "github":
              content = <AiFillGithub className={iconStyles} />;
              break;
            case "chrome-web-store":
              content = <AiFillChrome className={iconStyles} />;
              break;
            case "firefox-web-store":
              content = <ImFirefox className={iconStyles} />;
              break;
            case "hosted":
              content = <BiLinkExternal className={iconStyles} />;
              break;
            case "paper":
              content = <GiArchiveResearch className={iconStyles} />;
              break;
            default:
              return link.type;
          }

          return (
            <div
              key={linkIndex}
              className="btn btn-circle btn-ghost flex justify-center align-middle h-20 w-20"
              onClick={() => openLink(link.url)}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Slot machine - no background, just the 3D element
  const SlotMachineCard = () => (
    <TechStackSlotMachine
      key="slot-machine"
      className="w-full h-full min-h-[400px]"
    />
  );

  // Crash button card
  const CrashCard = () => <CrashProjectCard key="crash-button" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredProjects.map((project, i) => {
        // Insert slot machine and crash card before DeathMail (index 1)
        if (i === 1) {
          return (
            <>
              <SlotMachineCard />
              <CrashCard />
              {renderProjectCard(project, i)}
            </>
          );
        }
        return renderProjectCard(project, i);
      })}
      {/* If only 1 project, still show slot machine and crash card */}
      {filteredProjects.length === 1 && (
        <>
          <SlotMachineCard />
          <CrashCard />
        </>
      )}
    </div>
  );
};

export default Projects;
