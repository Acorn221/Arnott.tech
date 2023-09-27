import LighterFuelLogo from '@/pages/Home/Projects/assets/LighterFuel512.png';

const Text = {
  home: {
    title: 'James Arnott',
    intro:
    {
      title: 'About Me',
      text: "I'm a Computer Science Student / Software Developer "
        + "from Royal Holloway, University of London. I'm currently "
        + 'in my final year of studies there. I like doing full stack '
        + 'web development and doing web-based projects mainly.',
    },
    projects: {
      title: 'Here are some of my projects.',
      arr: [
        {
          title: 'Lighter Fuel, For Tinder',
          text: 'This chrome extension is an 𝑎𝑐𝑐𝑒𝑙𝑒𝑟𝑎𝑛𝑡 for Tinder users. '
          + 'It helps users quickly and efficiently identify fake profiles '
          + 'and potential scams. It displays the \'Last Modified\' Header value, '
          + 'which indicates when profile was created by showing when the profile '
          + 'photos were uploaded. Then it also allows for 1 click reverse image '
          + 'search to see if the photo has been uploaded online already.',
          link: {
            text: 'View on Github',
            url: 'https://github.com/Acorn221/LighterFuel-For-Tinder',
          },
          photo: LighterFuelLogo,
        },
        {
          title: 'Snap2Calendar Bithday Export',
          text: 'This extension lets you export birthdays from Snapchat to your Calendar, with notifications!',
          link: {
            text: 'View on The Chrome Web Store',
            url: 'https://chrome.google.com/webstore/detail/snap2calendar-birthday-ex/hejjegjbfaabkgaejceenfeeeocbocmk',
          }
        },
        {
          title: 'Alzheimer\'s and Skin Cancer Classification through Transfer Learning',
          text: 'This was my final year project for my degree. I compared different base models for transfer learning, to help classify diseases, along with analysing then optimising their outputs.',
          link: {
            text: 'View on Github',
            url: 'https://github.com/Acorn221/RHUL-Final-Year-Project/',
          },
        },
        {
          title: 'Hopalong Redux Enhanced',
          text: 'This is a fork of the Hopalong Redux project, which uses the Hopalong Attractor to generate fractal images. I\'ve optimised it for lower resolution screens with machine learning, so the patterns more distinctly appear. This was used on the Computing Society hosted 80s90s00s nights',
          link: {
            text: 'View on Github',
            url: 'https://github.com/Acorn221/hopalong-redux',
          },
        },
        {
          title: 'Arcio',
          text: 'Arcio was a project I worked on with my friends, the goal was to create a Management Information System (MIS) to help schools and universities mark attendance and manage timetables in a more efficient manner. It was unforntunately never completed due to issues with funding and our university work getting in the way. It was a good learning experience though, we had learnt a lot about the technologies we used and how to work in a team well. I\'ve opensourced the code to demonstrate mine and my team\'s skills and experience. I worked mainly on the database side, along with the frontend design and some of the backend.',
          link: {
            text: 'View the organisation on Github',
            url: 'https://github.com/arcio-uk',
          },
        },
        {
          title: 'Common Transfer Form Generator',
          text: 'This is a tool to help create test Common Transfer Forms (CTFs). '
          + 'They are an XML standard created by the department for education '
          + 'as a standard to allow for the transfer of data between MIS systems '
          + 'used in schools and local authorities. This was build using Typescript.',
          link: {
            text: 'View on Github',
            url: 'https://github.com/arcio-uk/Common-transfer-file-CTF-Test-Data-Generator',
          },
        },
      ],
    },
    slides: {
      frontend: {
        text: 'The Frontend Web Technologies I Use',
      },
      backend: {
        text: 'The Backend Web Technologies Technologies I Use',
      },
      devTools: {
        text: 'The DevTools I Use',
      },
      otherPrograms: {
        text: 'Other Programs I\'m comfortable with',
      },
    },
    contactMe: {
      title: 'Contact Me',
      linkedIn: {
        text: 'LinkedIn',
      },
      email: {
        text: 'Email (Mailto)',
      },
      gmail: {
        text: 'Email (Gmail)',
      },
    },
  },
  layout: {
    footer: {
      content: 'Copyright © James Arnott, Built from the ground up with React and Typescript, Deployed with Cloudflare Pages',
    },
  },
};

export default Text;
