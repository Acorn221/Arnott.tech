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
  },
  layout: {
    footer: {
      content: 'Copyright © James Arnott, Built from the ground up with React and Typescript',
    },
  },
};

export default Text;
