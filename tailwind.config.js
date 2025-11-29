/* eslint-disable import/no-extraneous-dependencies */

const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  compilerOptions: {
    baseUrl: 'src/',
  },
  theme: {
    extend: {
      animation: {
        iconBoxHoverAnimation: 'iconBoxHoverKeyFrames .1s ease-out',
        submitButtonHoverAnimation: 'submitButtonHoverKeyFrames .1s ease-out',
      },
      keyframes: {
        iconBoxHoverKeyFrames: {
          '0%': {
            backgroundColor: colors.white,
            borderColor: colors.white,
          },
          '100%': {
            backgroundColor: colors.neutral[200],
            borderColor: colors.slate[500],
          },
        },
        submitButtonHoverKeyFrames: {
          '0%': {
            backgroundColor: colors.purple[500],
          },
          '100%': {
            backgroundColor: colors.purple[600],
          },
        },
      },
    },
  },
  plugins: [
    function ({ addComponents, addBase }) {
      addBase({
        '@keyframes pulse': {
          '0%': {
            transform: 'scale(0.33)',
          },
          '80%, 100%': {
            opacity: '0',
          },
        },
        '@keyframes circle': {
          '0%': {
            transform: 'scale(0.8)',
          },
          '50%': {
            transform: 'scale(1)',
          },
          '100%': {
            transform: 'scale(0.8)',
          },
        },
      });

      const circles = {
        '.circle-2, .circle-4, .circle-6, .circle-8': {
          position: 'relative',
          display: 'inline-block',
          '&::before': {
            content: '""',
            position: 'relative',
            display: 'block',
            width: '250%',
            height: '250%',
            boxSizing: 'border-box',
            marginLeft: '-75%',
            marginTop: '-75%',
            borderRadius: '25px',
            backgroundColor: '#75daad',
            animation: 'pulse 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '0',
            top: '0',
            display: 'block',
            width: '100%',
            height: '100%',
            backgroundColor: '#75daad',
            borderRadius: '40px',
            animation: 'circle 1.25s cubic-bezier(0.455, 0.03, 0.515, 0.955) -0.4s infinite',
          },
        },
        '.circle-2': {
          width: '10px',
          height: '10px',
        },
        '.circle-4': {
          width: '20px',
          height: '20px',
        },
        '.circle-6': {
          width: '30px',
          height: '30px',
        },
        '.circle-8': {
          width: '40px',
          height: '40px',
        },
      };
      addComponents(circles);
    },
    require('tailwindcss-animatecss')({
      classes: ['animate__animated', 'animate__fadeIn', 'animate__bounceIn', 'animate__lightSpeedOut', 'animate__rollIn', 'animate__backInUp', 'animate__fast', 'animate__faster', 'animate__backOutDown'],
      settings: {
        animatedSpeed: 500,
        heartBeatSpeed: 1000,
        fadeIn: 300,
        hingeSpeed: 2000,
        bounceInSpeed: 750,
        bounceOutSpeed: 750,
        animationDelaySpeed: 1000,
        backOutDown: 500,
      },
      variants: ['responsive', 'hover', 'reduced-motion'],
    }),
    require('daisyui'),
  ],
  include: [
    'src',
  ],
};
