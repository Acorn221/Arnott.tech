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
          text: 'This chrome extension is an 𝑎𝑐𝑐𝑒𝑙𝑒𝑟𝑎𝑛𝑡 for Tinder users.'
          + 'It helps users quickly and efficiently identify fake profiles '
          + 'and potential scams. It displays the \'Last Modified\' Header value, '
          + 'which indicates when profile was created by showing when the profile '
          + 'photos were uploaded. Then it also allows for 1 click reverse image '
          + 'search to see if the photo has been uploaded online already.',
          photo: LighterFuelLogo,
          link: {
            text: 'View on Github',
            url: 'https://github.com/Acorn221/LighterFuel-For-Tinder',
          },
        },
      ],
    },
    slides: {
      frontend: {
        text: 'The Frontend Web Technologies I Have Used',
      },
      backend: {
        text: 'The Backend Web Technologies I\'m Familiar With',
      },
      devTools: {
        text: 'The DevTools I\'m Familiar With',
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
