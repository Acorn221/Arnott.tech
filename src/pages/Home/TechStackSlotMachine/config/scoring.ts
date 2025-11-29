import { Technology, getTechnologyById } from './technologies';

// ============================================================================
// Types
// ============================================================================

export interface ComboRule {
  /** Pattern: [backend, frontend, database] - use '*' for any, or tech id */
  pattern: [string, string, string];
  /** Score modifier (positive = bonus, negative = penalty) */
  modifier: number;
  /** Human-readable reason */
  reason: string;
  /** Priority for display (higher = show first) */
  priority: number;
}

export interface AppliedCombo {
  rule: ComboRule;
  applied: boolean;
}
export interface ScoreResult {
  /** Final score 0-100 */
  score: number;
  /** Score category label */
  label: string;
  /** Emoji for the category */
  emoji: string;
  /** Color for display */
  color: string;
  /** Applied combo rules */
  appliedCombos: AppliedCombo[];
  /** Base score breakdown */
  baseScores: {
    backend: number;
    frontend: number;
    database: number;
  };
}

// ============================================================================
// Combo Rules
// ============================================================================

export const COMBO_RULES: ComboRule[] = [
  // =========================================================================
  // PERFECT COMBOS (+15 to +25)
  // =========================================================================
  {
    pattern: ['typescript', 'nextjs', 'postgresql'],
    modifier: 25,
    reason: 'The holy trinity of modern web dev',
    priority: 100,
  },
  {
    pattern: ['typescript', 'react-ts', 'postgresql'],
    modifier: 20,
    reason: 'Full TypeScript stack perfection',
    priority: 95,
  },
  {
    pattern: ['go', 'htmx', 'postgresql'],
    modifier: 20,
    reason: 'Simplicity enjoyer detected',
    priority: 90,
  },
  {
    pattern: ['rust', '*', 'postgresql'],
    modifier: 15,
    reason: 'Memory safety meets ACID compliance',
    priority: 85,
  },
  {
    pattern: ['elixir', '*', 'postgresql'],
    modifier: 15,
    reason: 'Phoenix rising from the database',
    priority: 80,
  },

  // =========================================================================
  // GOOD SYNERGIES (+5 to +15)
  // =========================================================================
  {
    pattern: ['typescript', '*', 'supabase'],
    modifier: 10,
    reason: 'TypeScript + Supabase type generation',
    priority: 70,
  },
  {
    pattern: ['*', 'nextjs', 'supabase'],
    modifier: 10,
    reason: 'Vercel ecosystem synergy',
    priority: 70,
  },
  {
    pattern: ['*', 'nuxt', 'supabase'],
    modifier: 8,
    reason: 'Vue + Supabase is a vibe',
    priority: 65,
  },
  {
    pattern: ['typescript', 'svelte-ts', '*'],
    modifier: 10,
    reason: 'TypeScript all the way down',
    priority: 60,
  },
  {
    pattern: ['typescript', 'vue-ts', '*'],
    modifier: 10,
    reason: 'TypeScript + Vue composition API',
    priority: 60,
  },
  {
    pattern: ['go', '*', 'postgresql'],
    modifier: 12,
    reason: 'Go + Postgres is chef\'s kiss',
    priority: 75,
  },
  {
    pattern: ['kotlin', 'react-ts', 'postgresql'],
    modifier: 10,
    reason: 'Modern JVM + Modern Frontend',
    priority: 55,
  },

  // =========================================================================
  // DOCUMENT DB PENALTIES (-10 to -20)
  // =========================================================================
  {
    pattern: ['*', '*', 'mongodb'],
    modifier: -15,
    reason: '🚨 Document database detected',
    priority: 50,
  },
  {
    pattern: ['*', '*', 'firebase'],
    modifier: -12,
    reason: 'Vendor lock-in speedrun any%',
    priority: 50,
  },
  {
    pattern: ['*', '*', 'dynamodb'],
    modifier: -10,
    reason: 'AWS bill go brrrrr',
    priority: 50,
  },

  // =========================================================================
  // TYPE MISMATCH PENALTIES (-5 to -15)
  // =========================================================================
  {
    pattern: ['typescript', 'react-js', '*'],
    modifier: -10,
    reason: 'TS backend with JS frontend? Pick a lane',
    priority: 45,
  },
  {
    pattern: ['typescript', 'vue-js', '*'],
    modifier: -10,
    reason: 'Type safety is all or nothing',
    priority: 45,
  },
  {
    pattern: ['typescript', 'vanilla-js', '*'],
    modifier: -12,
    reason: 'You were so close to greatness',
    priority: 45,
  },
  {
    pattern: ['python', 'react-ts', '*'],
    modifier: -8,
    reason: 'Dynamic meets static, chaos ensues',
    priority: 40,
  },

  // =========================================================================
  // LEGACY/CURSED PENALTIES (-15 to -30)
  // =========================================================================
  {
    pattern: ['*', 'jquery', '*'],
    modifier: -25,
    reason: 'Sir, this is 2024',
    priority: 100,
  },
  {
    pattern: ['*', 'vanilla-js', '*'],
    modifier: -20,
    reason: 'No framework? No types? Brave.',
    priority: 90,
  },
  {
    pattern: ['*', 'react-js', '*'],
    modifier: -15,
    reason: 'React without TypeScript 😬',
    priority: 90,
  },
  {
    pattern: ['*', 'vue-js', '*'],
    modifier: -15,
    reason: 'Vue without TypeScript 😬',
    priority: 90,
  },
  {
    pattern: ['*', 'svelte-js', '*'],
    modifier: -15,
    reason: 'Svelte without TypeScript 😬',
    priority: 90,
  },
  {
    pattern: ['php', 'jquery', '*'],
    modifier: -50,
    reason: 'Time traveler from 2008 detected',
    priority: 100,
  },
  {
    pattern: ['php', '*', '*'],
    modifier: -25,
    reason: 'PHP detected 🤮',
    priority: 90,
  },
  {
    pattern: ['php', '*', 'mysql'],
    modifier: -15,
    reason: 'LAMP stack nostalgia hitting hard',
    priority: 85,
  },
  {
    pattern: ['php', '*', 'mongodb'],
    modifier: -30,
    reason: 'Two wrongs definitely don\'t make a right',
    priority: 85,
  },
  {
    pattern: ['php', '*', 'postgresql'],
    modifier: 5,
    reason: 'At least you picked a good database',
    priority: 80,
  },
  {
    pattern: ['java', 'angular', '*'],
    modifier: -8,
    reason: 'Enterprise energy is strong',
    priority: 30,
  },

  // =========================================================================
  // SPECIAL/MEME COMBOS
  // =========================================================================
  {
    pattern: ['c', '*', 'sqlite'],
    modifier: 5,
    reason: 'Embedded systems chad',
    priority: 25,
  },
  {
    pattern: ['rust', 'htmx', 'sqlite'],
    modifier: 15,
    reason: 'Local-first minimalist king',
    priority: 80,
  },
  {
    pattern: ['haskell', '*', '*'],
    modifier: -5,
    reason: 'Monads everywhere',
    priority: 20,
  },
  {
    pattern: ['*', '*', 'redis'],
    modifier: 5,
    reason: 'Speed demon (but where\'s your real DB?)',
    priority: 15,
  },
];

// ============================================================================
// Score Categories
// ============================================================================

interface ScoreCategory {
  min: number;
  max: number;
  label: string;
  emoji: string;
  color: string;
}

const SCORE_CATEGORIES: ScoreCategory[] = [
  {
    min: 90, max: 100, label: 'Perfect Stack', emoji: '🏆', color: '#FFD700',
  },
  {
    min: 80, max: 89, label: 'Excellent Choice', emoji: '✨', color: '#4ADE80',
  },
  {
    min: 70, max: 79, label: 'Solid Stack', emoji: '✅', color: '#22C55E',
  },
  {
    min: 60, max: 69, label: 'Decent Setup', emoji: '👍', color: '#84CC16',
  },
  {
    min: 50, max: 59, label: 'It Works...', emoji: '🤷', color: '#EAB308',
  },
  {
    min: 40, max: 49, label: 'Questionable', emoji: '⚠️', color: '#F97316',
  },
  {
    min: 25, max: 39, label: 'Concerning', emoji: '😬', color: '#EF4444',
  },
  {
    min: 0, max: 24, label: 'Chaotic Evil', emoji: '💀', color: '#7F1D1D',
  },
];

// ============================================================================
// Scoring Logic
// ============================================================================

/** Check if a pattern matches the given tech IDs */
const matchesPattern = (
  pattern: [string, string, string],
  techIds: [string, string, string],
): boolean => pattern.every((p, i) => p === '*' || p === techIds[i]);

/** Calculate the final score for a tech combination */
export const calculateScore = (
  backendId: string,
  frontendId: string,
  databaseId: string,
): ScoreResult => {
  const backend = getTechnologyById(backendId);
  const frontend = getTechnologyById(frontendId);
  const database = getTechnologyById(databaseId);

  if (!backend || !frontend || !database) {
    throw new Error(`Unknown technology ID: ${backendId}, ${frontendId}, or ${databaseId}`);
  }

  // Calculate base score (average of the three)
  const baseScores = {
    backend: backend.baseScore,
    frontend: frontend.baseScore,
    database: database.baseScore,
  };

  const avgBaseScore = (baseScores.backend + baseScores.frontend + baseScores.database) / 3;

  // Apply combo modifiers
  const techIds: [string, string, string] = [backendId, frontendId, databaseId];
  const appliedCombos: AppliedCombo[] = [];
  let totalModifier = 0;

  for (const rule of COMBO_RULES) {
    const matches = matchesPattern(rule.pattern, techIds);
    appliedCombos.push({ rule, applied: matches });
    if (matches) {
      totalModifier += rule.modifier;
    }
  }

  // Calculate final score (clamped 0-100)
  const rawScore = avgBaseScore + totalModifier;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Get category
  const category = SCORE_CATEGORIES.find((c) => score >= c.min && score <= c.max)
    || SCORE_CATEGORIES[SCORE_CATEGORIES.length - 1];

  // Sort applied combos by priority (highest first), only include applied ones
  const sortedAppliedCombos = appliedCombos
    .filter((c) => c.applied)
    .sort((a, b) => b.rule.priority - a.rule.priority);

  // Special score labels
  let { label } = category;
  let { emoji } = category;
  if (score === 69) {
    label = 'nice';
    emoji = '😏';
  } else if (score === 67) {
    label = '6,7';
    emoji = '🎵';
  }

  return {
    score,
    label,
    emoji,
    color: category.color,
    appliedCombos: sortedAppliedCombos,
    baseScores,
  };
};

/** Get a fun message based on the score result */
export const getScoreMessage = (result: ScoreResult): string => {
  if (result.appliedCombos.length > 0) {
    return result.appliedCombos[0].rule.reason;
  }

  if (result.score >= 80) {
    return 'A respectable technology choice!';
  }
  if (result.score >= 60) {
    return 'Could be worse, could be better.';
  }
  if (result.score >= 40) {
    return 'Are you sure about this?';
  }
  return 'Seek professional help.';
};
