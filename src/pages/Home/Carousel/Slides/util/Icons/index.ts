import TailwindCss from 'devicon/icons/tailwindcss/tailwindcss-original.svg';
import ReactIcon from 'devicon/icons/react/react-original.svg';
import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import JavascriptIcon from 'devicon/icons/javascript/javascript-plain.svg';
import MaterialUiIcon from 'devicon/icons/materialui/materialui-original.svg';
import ReduxIcon from 'devicon/icons/redux/redux-original.svg';
import GraphQLIcon from 'devicon/icons/graphql/graphql-plain.svg';
import PostgresIcon from 'devicon/icons/postgresql/postgresql-plain.svg';
import GoIcon from 'devicon/icons/go/go-original-wordmark.svg';
import PythonIcon from 'devicon/icons/python/python-original.svg';
import MySQLIcon from 'devicon/icons/mysql/mysql-original.svg';
import NextJSIcon from 'devicon/icons/nextjs/nextjs-line.svg';
import AWSIcon from 'devicon/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg';
import GitIcon from 'devicon/icons/git/git-original.svg';
import VScodeIcon from 'devicon/icons/vscode/vscode-original.svg';
import ChromeIcon from 'devicon/icons/chrome/chrome-plain.svg';
import JestIcon from 'devicon/icons/jest/jest-plain.svg';
import PhotoshopIcon from 'devicon/icons/photoshop/photoshop-plain.svg';
import SlackIcon from 'devicon/icons/slack/slack-original.svg';
import GSuiteIcon from 'devicon/icons/google/google-plain.svg';
import ExcelIcon from './assets/excel.svg';
import DynamoDBIcon from './assets/dynamoDB.svg';
import LambdaIcon from './assets/lambda.svg';
import ViteIcon from './assets/vite.svg';
import PostmanIcon from './assets/postman.svg';
import GitKrakenIcon from './assets/gitkraken.svg';
import EslintIcon from './assets/eslint.svg';
import DiscordIcon from './assets/discord.svg';
import Teams from './assets/teams.svg';
import OnshapeIcon from './assets/onshape.svg';
import AmplifyIcon from './assets/ampliify.svg';

export interface IconInterface {
  icon: string;
  tooltipText: string;
  confidence?: number;
}

/**
 * The icons array,
 * which contains the icons to be displayed in the carosel.
 * There is no need for translation with these names.
 */
export const FrontendIcons: IconInterface[] = [
  {
    icon: TypeScriptIcon,
    tooltipText: 'TypeScript',
  },
  {
    icon: JavascriptIcon,
    tooltipText: 'Javascript',
  },
  {
    icon: ReactIcon,
    tooltipText: 'React',
  },
  {
    icon: TailwindCss,
    tooltipText: 'Tailwind CSS',
  },
  {
    icon: MaterialUiIcon,
    tooltipText: 'Material-UI',
  },
  {
    icon: ReduxIcon,
    tooltipText: 'Redux',
    confidence: 0.5,
  },
  {
    icon: ViteIcon,
    tooltipText: 'Vite',
  },
];

export const BackendIcons: IconInterface[] = [
  {
    icon: TypeScriptIcon,
    tooltipText: 'TypeScript',
  },
  {
    icon: JavascriptIcon,
    tooltipText: 'Javascript',
  },
  {
    icon: GraphQLIcon,
    tooltipText: 'GraphQL',
  },
  {
    icon: PostgresIcon,
    tooltipText: 'PostgreSQL',
  },
  {
    icon: PythonIcon,
    tooltipText: 'Python',
  },
  {
    icon: GoIcon,
    tooltipText: 'GoLang',
    confidence: 0.5,
  },
  {
    icon: MySQLIcon,
    tooltipText: 'MySQL',
  },
  {
    icon: NextJSIcon,
    tooltipText: 'NextJS',
    confidence: 0.3,
  },
  {
    icon: AWSIcon,
    tooltipText: 'Amazon Web Services',
  },
  {
    icon: LambdaIcon,
    tooltipText: 'AWS Lambda',
    confidence: 0.5,
  },
  {
    icon: DynamoDBIcon,
    tooltipText: 'AWS DynamoDB',
    confidence: 0.5,
  },
  {
    icon: AmplifyIcon,
    tooltipText: 'AWS Amplify',
  },
];

export const DevToolsIcons: IconInterface[] = [
  {
    icon: VScodeIcon,
    tooltipText: 'VSCode',
  },
  {
    icon: ChromeIcon,
    tooltipText: 'Chrome',
  },
  {
    icon: JestIcon,
    tooltipText: 'Jest',
  },
  {
    icon: GitIcon,
    tooltipText: 'Git',
  },
  {
    icon: GitKrakenIcon,
    tooltipText: 'GitKraken',
  },
  {
    icon: EslintIcon,
    tooltipText: 'Eslint',
  },
  {
    icon: PostmanIcon,
    tooltipText: 'Postman',
  },
];

export const OtherProgramsIcons: IconInterface[] = [
  {
    icon: PhotoshopIcon,
    tooltipText: 'Photoshop',
  },
  {
    icon: ExcelIcon,
    tooltipText: 'Excel',
  },
  {
    icon: GSuiteIcon,
    tooltipText: 'Google GSuite Apps',
  },
  {
    icon: SlackIcon,
    tooltipText: 'Slack',
  },
  {
    icon: DiscordIcon,
    tooltipText: 'Discord',
  },
  {
    icon: Teams,
    tooltipText: 'Microsoft Teams',
  },
  {
    icon: OnshapeIcon,
    tooltipText: 'Onshape (cloud based CAD)',
  },
];
