// Technology icons from devicon
import TypeScriptIcon from 'devicon/icons/typescript/typescript-plain.svg';
import GoIcon from 'devicon/icons/go/go-original-wordmark.svg';
import RustIcon from 'devicon/icons/rust/rust-original.svg';
import PythonIcon from 'devicon/icons/python/python-original.svg';
import JavaIcon from 'devicon/icons/java/java-original.svg';
import CSharpIcon from 'devicon/icons/csharp/csharp-original.svg';
import RubyIcon from 'devicon/icons/ruby/ruby-original.svg';
import PhpIcon from 'devicon/icons/php/php-original.svg';
import KotlinIcon from 'devicon/icons/kotlin/kotlin-original.svg';
import ScalaIcon from 'devicon/icons/scala/scala-original.svg';
import ElixirIcon from 'devicon/icons/elixir/elixir-original.svg';
import CppIcon from 'devicon/icons/cplusplus/cplusplus-original.svg';
import CIcon from 'devicon/icons/c/c-original.svg';
import SwiftIcon from 'devicon/icons/swift/swift-original.svg';
import HaskellIcon from 'devicon/icons/haskell/haskell-original.svg';

import ReactIcon from 'devicon/icons/react/react-original.svg';
import VueIcon from 'devicon/icons/vuejs/vuejs-original.svg';
import SvelteIcon from 'devicon/icons/svelte/svelte-original.svg';
import NextJsIcon from 'devicon/icons/nextjs/nextjs-original.svg';
import NuxtIcon from 'devicon/icons/nuxtjs/nuxtjs-original.svg';
import AngularIcon from 'devicon/icons/angular/angular-original.svg';
import SolidJsIcon from 'devicon/icons/solidjs/solidjs-original.svg';
import JQueryIcon from 'devicon/icons/jquery/jquery-original.svg';
import JavaScriptIcon from 'devicon/icons/javascript/javascript-plain.svg';

import PostgresIcon from 'devicon/icons/postgresql/postgresql-original.svg';
import MySqlIcon from 'devicon/icons/mysql/mysql-original.svg';
import MariaDbIcon from 'devicon/icons/mariadb/mariadb-original.svg';
import SqliteIcon from 'devicon/icons/sqlite/sqlite-original.svg';
import MongoDbIcon from 'devicon/icons/mongodb/mongodb-original.svg';
import RedisIcon from 'devicon/icons/redis/redis-original.svg';
import CassandraIcon from 'devicon/icons/cassandra/cassandra-original.svg';
import Neo4jIcon from 'devicon/icons/neo4j/neo4j-original.svg';
import FirebaseIcon from 'devicon/icons/firebase/firebase-plain.svg';
import SupabaseIcon from 'devicon/icons/supabase/supabase-original.svg';

// Custom icons
import DynamoDbIcon from '../../Carousel/Slides/util/Icons/assets/dynamoDB.svg';

// ============================================================================
// Types
// ============================================================================

export type ReelCategory = 'backend' | 'frontend' | 'database';

export interface Technology {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  category: ReelCategory;
  baseScore: number; // 0-100
  tags: string[];
}

// ============================================================================
// Backend Languages
// ============================================================================

export const BACKEND_TECHNOLOGIES: Technology[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    shortName: 'TS',
    icon: TypeScriptIcon,
    category: 'backend',
    baseScore: 90,
    tags: ['typed', 'modern', 'node'],
  },
  {
    id: 'go',
    name: 'Go',
    shortName: 'Go',
    icon: GoIcon,
    category: 'backend',
    baseScore: 88,
    tags: ['compiled', 'fast', 'simple'],
  },
  {
    id: 'rust',
    name: 'Rust',
    shortName: 'Rust',
    icon: RustIcon,
    category: 'backend',
    baseScore: 92,
    tags: ['compiled', 'memory-safe', 'fast'],
  },
  {
    id: 'python',
    name: 'Python',
    shortName: 'Py',
    icon: PythonIcon,
    category: 'backend',
    baseScore: 75,
    tags: ['scripting', 'ml', 'slow'],
  },
  {
    id: 'java',
    name: 'Java',
    shortName: 'Java',
    icon: JavaIcon,
    category: 'backend',
    baseScore: 70,
    tags: ['enterprise', 'verbose', 'jvm'],
  },
  {
    id: 'csharp',
    name: 'C# / .NET',
    shortName: 'C#',
    icon: CSharpIcon,
    category: 'backend',
    baseScore: 78,
    tags: ['enterprise', 'microsoft', 'typed'],
  },
  {
    id: 'ruby',
    name: 'Ruby',
    shortName: 'Ruby',
    icon: RubyIcon,
    category: 'backend',
    baseScore: 60,
    tags: ['scripting', 'rails', 'slow'],
  },
  {
    id: 'php',
    name: 'PHP',
    shortName: 'PHP',
    icon: PhpIcon,
    category: 'backend',
    baseScore: 25,
    tags: ['legacy', 'wordpress', 'cursed'],
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    shortName: 'Kt',
    icon: KotlinIcon,
    category: 'backend',
    baseScore: 82,
    tags: ['jvm', 'modern', 'android'],
  },
  {
    id: 'scala',
    name: 'Scala',
    shortName: 'Scala',
    icon: ScalaIcon,
    category: 'backend',
    baseScore: 72,
    tags: ['jvm', 'functional', 'complex'],
  },
  {
    id: 'elixir',
    name: 'Elixir',
    shortName: 'Elixir',
    icon: ElixirIcon,
    category: 'backend',
    baseScore: 80,
    tags: ['functional', 'concurrent', 'erlang'],
  },
  {
    id: 'cpp',
    name: 'C++',
    shortName: 'C++',
    icon: CppIcon,
    category: 'backend',
    baseScore: 65,
    tags: ['compiled', 'low-level', 'complex'],
  },
  {
    id: 'c',
    name: 'C',
    shortName: 'C',
    icon: CIcon,
    category: 'backend',
    baseScore: 55,
    tags: ['compiled', 'low-level', 'manual-memory'],
  },
  {
    id: 'swift',
    name: 'Swift',
    shortName: 'Swift',
    icon: SwiftIcon,
    category: 'backend',
    baseScore: 76,
    tags: ['apple', 'modern', 'safe'],
  },
  {
    id: 'haskell',
    name: 'Haskell',
    shortName: 'Haskell',
    icon: HaskellIcon,
    category: 'backend',
    baseScore: 68,
    tags: ['functional', 'pure', 'academic'],
  },
];

// ============================================================================
// Frontend Frameworks
// ============================================================================

export const FRONTEND_TECHNOLOGIES: Technology[] = [
  {
    id: 'react-ts',
    name: 'React + TypeScript',
    shortName: 'React+TS',
    icon: ReactIcon,
    category: 'frontend',
    baseScore: 92,
    tags: ['typed', 'react', 'modern'],
  },
  {
    id: 'react-js',
    name: 'React + JavaScript',
    shortName: 'React+JS',
    icon: ReactIcon,
    category: 'frontend',
    baseScore: 75,
    tags: ['untyped', 'react', 'legacy'],
  },
  {
    id: 'vue-ts',
    name: 'Vue + TypeScript',
    shortName: 'Vue+TS',
    icon: VueIcon,
    category: 'frontend',
    baseScore: 85,
    tags: ['typed', 'vue', 'modern'],
  },
  {
    id: 'vue-js',
    name: 'Vue + JavaScript',
    shortName: 'Vue+JS',
    icon: VueIcon,
    category: 'frontend',
    baseScore: 70,
    tags: ['untyped', 'vue'],
  },
  {
    id: 'svelte-ts',
    name: 'Svelte + TypeScript',
    shortName: 'Svelte+TS',
    icon: SvelteIcon,
    category: 'frontend',
    baseScore: 88,
    tags: ['typed', 'svelte', 'compiled'],
  },
  {
    id: 'svelte-js',
    name: 'Svelte + JavaScript',
    shortName: 'Svelte+JS',
    icon: SvelteIcon,
    category: 'frontend',
    baseScore: 72,
    tags: ['untyped', 'svelte', 'compiled'],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    shortName: 'Next',
    icon: NextJsIcon,
    category: 'frontend',
    baseScore: 90,
    tags: ['react', 'fullstack', 'ssr'],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    shortName: 'Nuxt',
    icon: NuxtIcon,
    category: 'frontend',
    baseScore: 82,
    tags: ['vue', 'fullstack', 'ssr'],
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    shortName: 'SvelteKit',
    icon: SvelteIcon,
    category: 'frontend',
    baseScore: 86,
    tags: ['svelte', 'fullstack', 'ssr'],
  },
  {
    id: 'angular',
    name: 'Angular',
    shortName: 'Angular',
    icon: AngularIcon,
    category: 'frontend',
    baseScore: 65,
    tags: ['enterprise', 'google', 'complex'],
  },
  {
    id: 'solidjs',
    name: 'Solid.js',
    shortName: 'Solid',
    icon: SolidJsIcon,
    category: 'frontend',
    baseScore: 84,
    tags: ['reactive', 'fast', 'modern'],
  },
  {
    id: 'htmx',
    name: 'HTMX',
    shortName: 'HTMX',
    icon: JavaScriptIcon, // Use JS icon as placeholder
    category: 'frontend',
    baseScore: 78,
    tags: ['simple', 'hypermedia', 'minimal'],
  },
  {
    id: 'jquery',
    name: 'jQuery',
    shortName: 'jQuery',
    icon: JQueryIcon,
    category: 'frontend',
    baseScore: 20,
    tags: ['legacy', 'old', 'dom'],
  },
  {
    id: 'vanilla-js',
    name: 'Vanilla JavaScript',
    shortName: 'Vanilla',
    icon: JavaScriptIcon,
    category: 'frontend',
    baseScore: 50,
    tags: ['untyped', 'basic', 'raw'],
  },
];

// ============================================================================
// Databases
// ============================================================================

export const DATABASE_TECHNOLOGIES: Technology[] = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    shortName: 'Postgres',
    icon: PostgresIcon,
    category: 'database',
    baseScore: 95,
    tags: ['sql', 'relational', 'acid'],
  },
  {
    id: 'mysql',
    name: 'MySQL',
    shortName: 'MySQL',
    icon: MySqlIcon,
    category: 'database',
    baseScore: 75,
    tags: ['sql', 'relational', 'oracle'],
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    shortName: 'MariaDB',
    icon: MariaDbIcon,
    category: 'database',
    baseScore: 78,
    tags: ['sql', 'relational', 'mysql-fork'],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    shortName: 'SQLite',
    icon: SqliteIcon,
    category: 'database',
    baseScore: 70,
    tags: ['sql', 'embedded', 'simple'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    shortName: 'Mongo',
    icon: MongoDbIcon,
    category: 'database',
    baseScore: 35,
    tags: ['nosql', 'document', 'schemaless'],
  },
  {
    id: 'dynamodb',
    name: 'DynamoDB',
    shortName: 'DynamoDB',
    icon: DynamoDbIcon,
    category: 'database',
    baseScore: 55,
    tags: ['nosql', 'aws', 'key-value'],
  },
  {
    id: 'firebase',
    name: 'Firebase/Firestore',
    shortName: 'Firebase',
    icon: FirebaseIcon,
    category: 'database',
    baseScore: 45,
    tags: ['nosql', 'google', 'realtime'],
  },
  {
    id: 'redis',
    name: 'Redis',
    shortName: 'Redis',
    icon: RedisIcon,
    category: 'database',
    baseScore: 80,
    tags: ['cache', 'key-value', 'fast'],
  },
  {
    id: 'cassandra',
    name: 'Cassandra',
    shortName: 'Cassandra',
    icon: CassandraIcon,
    category: 'database',
    baseScore: 65,
    tags: ['nosql', 'distributed', 'wide-column'],
  },
  {
    id: 'neo4j',
    name: 'Neo4j',
    shortName: 'Neo4j',
    icon: Neo4jIcon,
    category: 'database',
    baseScore: 72,
    tags: ['graph', 'nosql', 'relationships'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    shortName: 'Supabase',
    icon: SupabaseIcon,
    category: 'database',
    baseScore: 85,
    tags: ['postgres', 'baas', 'realtime'],
  },
];

// ============================================================================
// All Technologies
// ============================================================================

export const ALL_TECHNOLOGIES: Technology[] = [
  ...BACKEND_TECHNOLOGIES,
  ...FRONTEND_TECHNOLOGIES,
  ...DATABASE_TECHNOLOGIES,
];

export const getTechnologyById = (id: string): Technology | undefined => ALL_TECHNOLOGIES.find((t) => t.id === id);

export const getTechnologiesByCategory = (category: ReelCategory): Technology[] => ALL_TECHNOLOGIES.filter((t) => t.category === category);

