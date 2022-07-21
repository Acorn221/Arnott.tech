import { XyzTransitionGroup } from '@animxyz/react';

import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import GraphQLIcon from 'devicon/icons/graphql/graphql-plain.svg';
import PostgresIcon from 'devicon/icons/postgresql/postgresql-plain.svg';
import FlaskIcon from 'devicon/icons/flask/flask-original.svg';
import GoIcon from 'devicon/icons/go/go-original-wordmark.svg';
import PythonIcon from 'devicon/icons/python/python-original.svg';
import MySQLIcon from 'devicon/icons/mysql/mysql-original.svg';
import NextJSIcon from 'devicon/icons/nextjs/nextjs-line.svg';
import AWSIcon from 'devicon/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg';
import { useContext, useEffect, useState } from 'react';
import LambdaIcon from './assets/lambda.svg';
import DynamoDBIcon from './assets/dynamoDB.svg';

import { CaroselContext } from '@/pages/Home/Carosel/';

import Text from '@/misc/Text';
import Slide from '../Slide';

const txt = Text.home.slides.backend;

const iconStyles = 'h-[12vmin] max-h-[8vh]';

interface BackendInterface {
  index: number;
}

const Backend = ({ index }: BackendInterface) => {
  const currentSlide = useContext(CaroselContext);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!seen) {
      if (currentSlide === index) {
        setSeen(true);
      }
    }
  }, [currentSlide]);

  return (
    <Slide className="bg-gradient-to-r from-yellow-700 to-red-700 text-white text-3xl">
      <div className="flex w-full h-full md:flex-row flex-col-reverse">
        <div className="flex-auto h-full flex justify-center align-middle">
          {seen && (
          <XyzTransitionGroup appear xyz="fade flip-up flip-left delay-5 stagger" className="m-auto brightness-0 invert grid grid-cols-4 gap-2 md:p-auto">
            <img src={TypeScriptIcon} className={iconStyles} />
            <img src={JavascriptIcon} className={iconStyles} />
            <img src={GraphQLIcon} className={iconStyles} />
            <img src={PostgresIcon} className={iconStyles} />
            <img src={PythonIcon} className={iconStyles} />
            <img src={FlaskIcon} className={iconStyles} />
            <img src={GoIcon} className={iconStyles} />
            <img src={MySQLIcon} className={iconStyles} />
            <img src={NextJSIcon} className={iconStyles} />
            <img src={AWSIcon} className={iconStyles} />
            <img src={DynamoDBIcon} className={iconStyles} />
            <img src={LambdaIcon} className={iconStyles} />
          </XyzTransitionGroup>
          )}
        </div>

        <div className="md:flex-1 flex-none align-middle m-auto">
          <div className="p-3 mr-6 md:mr-12 text-xl md:text-3xl">{txt.text}</div>
        </div>
      </div>
    </Slide>
  );
};

export default Backend;
