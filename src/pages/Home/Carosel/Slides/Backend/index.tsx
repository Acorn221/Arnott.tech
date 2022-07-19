import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import GraphQLIcon from 'devicon/icons/graphql/graphql-plain.svg';
import PostgresIcon from 'devicon/icons/postgresql/postgresql-plain.svg';
import FlaskIcon from 'devicon/icons/flask/flask-original.svg';
import GoIcon from 'devicon/icons/go/go-original-wordmark.svg';
import { FaAws } from 'react-icons/fa';
import { SiNextdotjs } from 'react-icons/si';
import { DiPython, DiMysql } from 'react-icons/di';
import LambdaIcon from './assets/lambda.svg';
import DynamoDBIcon from './assets/dynamoDB.svg';

import Text from '@/misc/Text';
import Slide from '../Slide';

const txt = Text.home.slides.backend;

const iconVh = '8vh';

const iconStyles = `h-[${iconVh}]`;

const Backend = () => (
  <Slide className="bg-gradient-to-r from-yellow-700 to-red-700 text-white text-3xl">
    <div className="flex w-full h-full">
      <div className="flex-1 h-full flex justify-center align-middle ">
        <div className="m-auto brightness-0 invert grid grid-cols-4 gap-2 ">
          <img src={TypeScriptIcon} className={iconStyles} />
          <img src={JavascriptIcon} className={iconStyles} />
          <img src={GraphQLIcon} className={iconStyles} />
          <img src={PostgresIcon} className={iconStyles} />
          <DiPython size={iconVh} />
          <img src={FlaskIcon} className={iconStyles} />
          <img src={GoIcon} className={iconStyles} />
          <DiMysql size={iconVh} />
          <SiNextdotjs size={iconVh} />
          <FaAws size={iconVh} />
          <img src={DynamoDBIcon} className={iconStyles} />
          <img src={LambdaIcon} className={iconStyles} />
        </div>
      </div>

      <div className="flex-1 align-middle m-auto">
        <div className="p-3 mr-6 md:mr-12 text-xl md:text-3xl">{txt.text}</div>
      </div>
    </div>
  </Slide>
);

export default Backend;
