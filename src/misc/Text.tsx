import LighterFuelLogo from "@/pages/Home/Projects/assets/LighterFuel512.png";
import Snap2CalLogo from "@/pages/Home/Projects/assets/snap2cal.png";
import JobStreamLogo from "@/pages/Home/Projects/assets/JobStreamLogo.svg";
import LinkedOutLogo from "@/pages/Home/Projects/assets/LinkedOutLogo.png";
import DeathMailLogo from "@/pages/Home/Projects/assets/DeathMail.svg";
import CubeAuthn from "@/pages/Home/Projects/assets/CubeAuthn.png";

export type textType = {
  home: {
    title: string;
    intro: {
      title: string;
      text: string;
    };
    projects: {
      title: string;
      arr: {
        title: string;
        text: string;
        link?: {
          text: string;
          url: string;
        };
        links?: {
          type: "github" | "chrome-web-store" | "firefox-web-store" | "hosted";
          url: string;
        }[];
        photo?: string;
        hideFromSource?: string[];
      }[];
    };
    slides: {
      frontend: {
        text: string;
      };
      backend: {
        text: string;
      };
      devTools: {
        text: string;
      };
      otherPrograms: {
        text: string;
      };
    };
    contactMe: {
      title: string;
      linkedIn: {
        text: string;
      };
      email: {
        text: string;
      };
      gmail: {
        text: string;
      };
    };
  };
  layout: {
    footer: {
      content: string;
    };
  };
};
const Text: textType = {
  home: {
    title: "James Arnott",
    intro: {
      title: "About Me",
      text:
        "I'm a Computer Science Graduate and Software Developer " +
        "from Royal Holloway, University of London. " +
        "I like doing everything to push startups forward, " +
        "with a focus on full stack development, along with a variety of machine learning and cryptography based projects",
    },
    projects: {
      title: "Here are some of my projects.",
      arr: [
        {
          title: "LighterFuel, For Tinder",
          text:
            "This chrome extension is an 𝑎𝑐𝑐𝑒𝑙𝑒𝑟𝑎𝑛𝑡 for Tinder users. " +
            "It helps users quickly and efficiently identify fake profiles " +
            "and potential scams. It displays the MongoDB ID date of the profile " +
            "which shows my users when their matches profiles were created and also allows for 1 click reverse image " +
            "search to see if the profile photos have been uploaded online.",
          links: [
            {
              type: "github",
              url: "https://github.com/Acorn221/LighterFuel-For-Tinder",
            },
            {
              type: "chrome-web-store",
              url: "https://chrome.google.com/webstore/detail/lighterfuel-for-tinder/bmcnbhnpmbkcpkhnmknmnkgdeodfljnc",
            },
          ],
          photo: LighterFuelLogo,
          hideFromSource: ["instagram.com", "l.instagram.com"],
        },
        {
          title: "DeathMail",
          text: "Send messages after you kick the bucket. End to 𝙩𝙝𝙚 end encryption. DeathMail is the first platform that properly implements end to end encryption with passkey based encryption for the users so they have control over their keys.",
          photo: DeathMailLogo,
          links: [
            {
              type: "hosted",
              url: "https://deathmail.ai/",
            },
          ],
        },
        {
          title: "CubeAuthn",
          text: "Use a Rubik's cube to secure your passkeys. CubeAuthn transforms a Bluetooth-enabled Rubik's cube into a WebAuthn-compatible authenticator by using the cube's physical state to deterministically generate cryptographic keypairs for passkeys",
          photo: CubeAuthn,
          links: [
            {
              type: "github",
              url: "https://github.com/Acorn221/CubeAuthn",
            },
            {
              type: "chrome-web-store",
              url: "https://chromewebstore.google.com/detail/cubeauthn/koncigmbjmoapojihipbpfnmgkhmdlfl",
            },
          ],
        },
        {
          title: "LinkedOut",
          text: "LinkedOut simply adds anonymous 💩 reactions to LinkedIn. This does exactly what it says on the tin, and it does it well!",
          photo: LinkedOutLogo,
          links: [
            {
              type: "chrome-web-store",
              url: "https://chromewebstore.google.com/detail/linkedout-dislikes-for-li/dlcpbhmggchfghnagkpifgddnhgolgfg",
            },
            {
              type: "firefox-web-store",
              url: "https://addons.mozilla.org/en-US/firefox/addon/linkedout/",
            },
            {
              type: "hosted",
              url: "https://linkedout.lol/",
            },
          ],
        },
        {
          title: "JobStream",
          text:
            "JobStream allows you to easily generate cover letters and answer questions on applications." +
            "The goal for it is to allow users to apply to a variety of jobs quicker and more efficiently, whilst still making high quality applications.",
          links: [
            {
              type: "github",
              url: "https://github.com/acorn221/JobStream",
            },
            {
              type: "hosted",
              url: "https://jobstream.uk/",
            },
            {
              type: "chrome-web-store",
              url: "https://chromewebstore.google.com/detail/jobstream/ifflolleankklchmbldadfafffobjocj",
            },
          ],
          photo: JobStreamLogo,
        },
        {
          title: "Snap2Calendar Bithday Export",
          text: "This extension lets you export birthdays from Snapchat to your Calendar, with notifications!",
          links: [
            {
              type: "github",
              url: "https://github.com/J4A-Industries/Snap2Calendar-Birthday-Export",
            },
            {
              type: "chrome-web-store",
              url: "https://chrome.google.com/webstore/detail/snap2calendar-birthday-ex/hejjegjbfaabkgaejceenfeeeocbocmk",
            },
          ],
          photo: Snap2CalLogo,
        },
        {
          title:
            "Alzheimer's and Skin Cancer Classification through Transfer Learning",
          text: "This was my final year project for my degree. I compared different base models for transfer learning, to help classify diseases, along with analysing then optimising their outputs.",
          links: [
            {
              type: "github",
              url: "https://github.com/Acorn221/RHUL-Final-Year-Project/",
            },
            {
              type: "hosted",
              url: "https://acorn221.github.io/RHUL-FYP-Deployment/",
            },
          ],
        },
        {
          title: "Hopalong Redux Enhanced",
          text: "This is a fork of the Hopalong Redux project, which uses the Hopalong Attractor to generate fractal images. I've optimised it for lower resolution screens with machine learning, so the patterns more distinctly appear. This was used on the Computing Society hosted 80s90s00s nights",
          links: [
            {
              type: "github",
              url: "https://github.com/Acorn221/hopalong-redux",
            },
            {
              type: "hosted",
              url: "https://acorn221.github.io/hopalong-redux/",
            },
          ],
        },
        {
          title: "Arcio",
          text: "Arcio was a project I worked on with my friends, the goal was to create a Management Information System (MIS) to help schools and universities mark attendance and manage timetables in a more efficient manner. It was unforntunately never completed due to issues with funding and our university work getting in the way. It was a good learning experience though, we had learnt a lot about the technologies we used and how to work in a team well. I've opensourced the code to demonstrate mine and my team's skills and experience. I worked mainly on the database side, along with the frontend design and some of the backend.",
          links: [
            {
              type: "github",
              url: "https://github.com/arcio-uk",
            },
            {
              type: "hosted",
              url: "https://arcio-uk.github.io/Sales-Website/",
            },
          ],
        },
        {
          title: "Common Transfer Form Generator",
          text:
            "This is a tool to help create test Common Transfer Forms (CTFs). " +
            "They are an XML standard created by the department for education " +
            "as a standard to allow for the transfer of data between MIS systems " +
            "used in schools and local authorities. This was build using Typescript.",
          links: [
            {
              type: "github",
              url: "https://github.com/arcio-uk/Common-transfer-file-CTF-Test-Data-Generator",
            },
          ],
        },
      ],
    },
    slides: {
      frontend: {
        text: "The Frontend Web Technologies I Use",
      },
      backend: {
        text: "The Backend Web Technologies Technologies I Use",
      },
      devTools: {
        text: "The DevTools I Use",
      },
      otherPrograms: {
        text: "Other Programs I'm comfortable with",
      },
    },
    contactMe: {
      title: "Contact Me",
      linkedIn: {
        text: "LinkedIn",
      },
      email: {
        text: "Email (Mailto)",
      },
      gmail: {
        text: "Email (Gmail)",
      },
    },
  },
  layout: {
    footer: {
      content:
        "Copyright © James Arnott, Built from the ground up with React and Typescript, Deployed with Cloudflare Pages",
    },
  },
};

export default Text;
