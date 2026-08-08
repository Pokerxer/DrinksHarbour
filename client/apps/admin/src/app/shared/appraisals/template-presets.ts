/**
 * Industry-standard appraisal template presets.
 *
 * Each preset maps to the DraftSection/DraftQuestion types the server already
 * accepts — no schema change required. The presets are purely client-side
 * seed data used when HR picks a starting point on the /templates/new screen.
 *
 * Research sources: AIHR "12 Performance Review Templates", Indeed
 * "Performance Appraisal Forms", SHRM, and 360-degree feedback best
 * practices (3–5 core competencies, 5-point unipolar scale, behavioural
 * questions, SMART goal frameworks).
 */

import type { DraftSection, FeedbackKind } from '@/services/appraisal.service';

export interface TemplatePreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** Icon component name (PiDuotone) — caller resolves the actual import. */
  icon: string;
  /** Audience badges shown on the card. */
  audiences: FeedbackKind[];
  /** Total questions in this preset. Computed at definition time. */
  questionCount: number;
  /** The sections to pre-populate. */
  sections: DraftSection[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rating(
  label: string,
  opts?: {
    helpText?: string;
    askOf?: FeedbackKind[];
    scaleMax?: number;
    required?: boolean;
  }
): DraftSection['questions'][number] {
  return {
    type: 'rating',
    label,
    helpText: opts?.helpText,
    required: opts?.required ?? true,
    scaleMax: opts?.scaleMax ?? 5,
    askOf: opts?.askOf ?? ['self', 'manager', 'peer'],
  };
}

function likert(
  label: string,
  opts?: {
    helpText?: string;
    askOf?: FeedbackKind[];
    scaleMax?: number;
    scaleLabels?: { low?: string; high?: string };
    required?: boolean;
  }
): DraftSection['questions'][number] {
  return {
    type: 'likert',
    label,
    helpText: opts?.helpText,
    required: opts?.required ?? true,
    scaleMax: opts?.scaleMax ?? 5,
    scaleLabels: opts?.scaleLabels,
    askOf: opts?.askOf ?? ['self', 'manager', 'peer'],
  };
}

function choice(
  label: string,
  opts: {
    options: string[];
    multiple?: boolean;
    askOf?: FeedbackKind[];
    helpText?: string;
    required?: boolean;
  }
): DraftSection['questions'][number] {
  return {
    type: 'choice',
    label,
    helpText: opts.helpText,
    required: opts.required ?? true,
    options: opts.options,
    multiple: opts.multiple ?? false,
    askOf: opts.askOf ?? ['self', 'manager'],
  };
}

function yesNo(
  label: string,
  opts?: {
    helpText?: string;
    askOf?: FeedbackKind[];
    required?: boolean;
  }
): DraftSection['questions'][number] {
  return {
    type: 'yes_no',
    label,
    helpText: opts?.helpText,
    required: opts?.required ?? true,
    askOf: opts?.askOf ?? ['self', 'manager'],
  };
}

function text(
  label: string,
  opts?: {
    helpText?: string;
    askOf?: FeedbackKind[];
    required?: boolean;
  }
): DraftSection['questions'][number] {
  return {
    type: 'text',
    label,
    helpText: opts?.helpText,
    required: opts?.required ?? true,
    askOf: opts?.askOf ?? ['self', 'manager'],
  };
}

function countQuestions(sections: DraftSection[]): number {
  return sections.reduce((n, s) => n + s.questions.length, 0);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const standardPerformanceReview: DraftSection[] = [
  {
    title: 'Core Competencies',
    questions: [
      rating('Quality of Work', {
        helpText:
          'Accuracy, thoroughness, and attention to detail in deliverables.',
        askOf: ['manager'],
      }),
      likert('Communication Skills', {
        helpText:
          'Clarity in verbal and written communication; active listening.',
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      rating('Teamwork & Collaboration', {
        helpText:
          'Willingness to support colleagues, share knowledge, and work cross-functionally.',
        askOf: ['self', 'manager', 'peer'],
      }),
      rating('Problem-Solving', {
        helpText:
          'Ability to identify issues, evaluate options, and implement effective solutions.',
        askOf: ['manager'],
      }),
      choice('Primary work style', {
        options: ['Independent', 'Collaborative', 'Mixed', 'Leadership-driven'],
        helpText:
          'How would you describe the dominant work style during this period?',
        askOf: ['self', 'manager'],
      }),
      rating('Adaptability', {
        helpText:
          'Flexibility in responding to change, learning new skills, and handling ambiguity.',
        askOf: ['self', 'manager', 'peer'],
      }),
    ],
  },
  {
    title: 'Goal Assessment',
    questions: [
      text('Goals achieved this review period', {
        helpText:
          'List the key goals set at the start of the period and describe the outcome for each.',
        askOf: ['self', 'manager'],
      }),
      rating('Overall goal attainment', {
        helpText:
          'How well did the employee meet the goals agreed at the start of this period?',
        askOf: ['manager'],
      }),
      text('Goals for the next review period', {
        helpText:
          'Propose SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound) for the upcoming period.',
        askOf: ['self', 'manager'],
      }),
    ],
  },
  {
    title: 'Strengths & Areas for Improvement',
    questions: [
      text('Key strengths demonstrated', {
        helpText:
          "Highlight the employee's greatest strengths and how they contributed to team or business success.",
        askOf: ['self', 'manager', 'peer'],
      }),
      text('Areas for improvement', {
        helpText:
          'Identify specific skills or behaviours the employee could develop, with concrete examples.',
        askOf: ['self', 'manager'],
      }),
    ],
  },
  {
    title: 'Development Plan',
    questions: [
      choice('Preferred development approach', {
        options: [
          'On-the-job training',
          'Formal courses',
          'Mentoring/coaching',
          'Cross-functional projects',
          'Self-directed learning',
        ],
        multiple: true,
        helpText: "Which approaches would best support this employee's growth?",
        askOf: ['self', 'manager'],
      }),
      text('Training and development needs', {
        helpText:
          'What training, courses, or mentoring would help the employee grow? Include timelines and expected outcomes.',
        askOf: ['self', 'manager'],
      }),
      yesNo('Employee is ready for additional responsibilities', {
        helpText:
          'Does the employee demonstrate readiness for expanded scope or leadership duties?',
        askOf: ['manager'],
      }),
      text('Career aspirations', {
        helpText:
          'Where does the employee see themselves in 1–3 years? How can the organisation support this?',
        askOf: ['self'],
      }),
    ],
  },
];

/**
 * Every SCORED question here (rating/likert — the types buildComparison can
 * put side by side) asks 'self' as well as its raters, and that is not
 * decoration: a 360's output is the gap between how the subject rates
 * themselves and how their manager and peers rate them on the SAME competency.
 * Scoping a competency to raters only silently removes it from that
 * comparison, and because filterSections drops sections that come back
 * empty, a whole section can vanish from the self form. Unscored questions
 * stay rater-scoped where the subject genuinely cannot answer them ("would you
 * work with this person again?") or where the value is the rater's own
 * observation. Enforced by template-presets.test.ts.
 */
const threeSixtyFeedback: DraftSection[] = [
  {
    title: 'Leadership & Decision-Making',
    questions: [
      likert('Sets a clear direction for the team', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      likert('Makes timely, well-informed decisions', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      likert('Takes ownership and holds others accountable', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
    ],
  },
  {
    title: 'Communication & Collaboration',
    questions: [
      likert('Communicates expectations clearly', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Never', high: 'Always' },
      }),
      likert('Listens actively and considers different perspectives', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Never', high: 'Always' },
      }),
      // Peer-scoped on purpose — how freely someone shares with the people
      // beside them is a peer's read, not a manager's. 'self' is added because
      // the self-vs-peer gap is exactly what makes it worth asking.
      likert('Shares information proactively with the team', {
        askOf: ['self', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      text('Provide a specific example of effective communication', {
        askOf: ['manager', 'peer'],
        required: false,
      }),
    ],
  },
  {
    title: 'Technical & Role Competency',
    questions: [
      rating('Demonstrates strong technical / role-specific skills', {
        askOf: ['self', 'manager', 'peer'],
      }),
      choice('How would you rate their skill level overall?', {
        options: [
          'Needs significant development',
          'Developing',
          'Competent',
          'Proficient',
          'Expert',
        ],
        askOf: ['manager', 'peer'],
      }),
      likert('Keeps skills current and adopts new methods', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
    ],
  },
  {
    title: 'Culture & Values',
    questions: [
      likert('Embodies company values in day-to-day work', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      yesNo('Would you want to work with this person again?', {
        askOf: ['peer'],
      }),
      text('What is one thing this person should keep doing?', {
        askOf: ['self', 'manager', 'peer'],
      }),
      text('What is one thing this person should start doing?', {
        askOf: ['self', 'manager', 'peer'],
      }),
    ],
  },
];

const quarterlyCheckIn: DraftSection[] = [
  {
    title: 'Top Accomplishments',
    questions: [
      text('What were your top 3 accomplishments this quarter?', {
        askOf: ['self', 'manager'],
      }),
      text('What project or initiative are you most proud of?', {
        askOf: ['self'],
        required: false,
      }),
    ],
  },
  {
    title: 'Goals Progress',
    questions: [
      rating('Progress toward annual goals', {
        helpText:
          'Rate overall progress (1 = no progress, 5 = on track or ahead).',
        askOf: ['self', 'manager'],
      }),
      choice('Overall status this quarter', {
        options: [
          'Behind schedule',
          'On track',
          'Ahead of schedule',
          'Goals pivoted',
        ],
        askOf: ['self', 'manager'],
      }),
      text('What barriers slowed your progress this quarter?', {
        askOf: ['self', 'manager'],
      }),
    ],
  },
  {
    title: 'Challenges & Support',
    questions: [
      text('What challenges did you face, and how did you address them?', {
        askOf: ['self', 'manager'],
      }),
      yesNo('Do you have the tools and resources you need to succeed?', {
        askOf: ['self'],
      }),
      text('What support or resources do you need next quarter?', {
        askOf: ['self', 'manager'],
      }),
    ],
  },
  {
    title: 'Next Quarter Focus',
    questions: [
      text('What are your top priorities for next quarter?', {
        askOf: ['self', 'manager'],
      }),
      rating('How confident are you in meeting next quarter targets?', {
        askOf: ['self'],
      }),
    ],
  },
];

const probationReview: DraftSection[] = [
  {
    title: 'Role Understanding & Performance',
    questions: [
      rating('Demonstrates understanding of role responsibilities', {
        askOf: ['manager'],
      }),
      rating('Produces work that meets quality expectations', {
        askOf: ['manager'],
      }),
      rating('Meets deadlines and manages workload effectively', {
        askOf: ['manager'],
      }),
      choice('How would you describe their performance overall?', {
        options: [
          'Below expectations',
          'Meets expectations',
          'Exceeds expectations',
          'Significantly exceeds expectations',
        ],
        askOf: ['manager'],
      }),
    ],
  },
  {
    title: 'Learning & Adaptability',
    questions: [
      likert('Willingness to learn and accept feedback', {
        askOf: ['self', 'manager'],
        helpText:
          'How quickly does the employee pick up new skills and incorporate feedback?',
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      rating('Adapts to team processes and tools', {
        askOf: ['manager'],
      }),
    ],
  },
  {
    title: 'Team & Culture Fit',
    questions: [
      rating('Builds positive working relationships', {
        askOf: ['manager', 'peer'],
      }),
      likert('Demonstrates company values', {
        askOf: ['self', 'manager', 'peer'],
        scaleLabels: { low: 'Strongly Disagree', high: 'Strongly Agree' },
      }),
      text('How well has the employee integrated into the team?', {
        askOf: ['manager', 'peer'],
      }),
    ],
  },
  {
    title: 'Overall Assessment',
    questions: [
      text('Key achievements during the probation period', {
        askOf: ['manager'],
      }),
      text('Areas requiring further development', {
        askOf: ['manager'],
      }),
      choice('Recommendation', {
        options: ['Confirm employment', 'Extend probation', 'Exit'],
        helpText: 'What is your recommendation for this employee?',
        askOf: ['manager'],
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Exported presets array
// ---------------------------------------------------------------------------

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'standard',
    title: 'Standard Performance Review',
    subtitle: 'Comprehensive annual or semi-annual review',
    description:
      'The industry-standard appraisal covering core competencies, goal attainment, strengths, areas for improvement, and a development plan. Suitable for most organisations.',
    icon: 'PiClipboardText',
    audiences: ['self', 'manager', 'peer'],
    questionCount: countQuestions(standardPerformanceReview),
    sections: standardPerformanceReview,
  },
  {
    id: 'three-sixty',
    title: '360° Feedback',
    subtitle: 'Multi-rater leadership assessment',
    description:
      'Structured feedback from managers, peers, and self-assessment across leadership, communication, technical skill, and culture. Best for leadership development and culture alignment.',
    icon: 'PiArrowsClockwise',
    audiences: ['self', 'manager', 'peer'],
    questionCount: countQuestions(threeSixtyFeedback),
    sections: threeSixtyFeedback,
  },
  {
    id: 'quarterly',
    title: 'Quarterly Check-in',
    subtitle: 'Lightweight goal-tracking review',
    description:
      'A quick, focused review to track accomplishments, goal progress, and priorities for the next quarter. Keeps performance conversations continuous rather than annual.',
    icon: 'PiCalendarDots',
    audiences: ['self', 'manager'],
    questionCount: countQuestions(quarterlyCheckIn),
    sections: quarterlyCheckIn,
  },
  {
    id: 'probation',
    title: 'Probation Review',
    subtitle: 'New hire end-of-probation assessment',
    description:
      "Evaluates a new hire's role understanding, learning agility, cultural fit, and overall readiness at the end of their probationary period.",
    icon: 'PiUserFocus',
    audiences: ['self', 'manager', 'peer'],
    questionCount: countQuestions(probationReview),
    sections: probationReview,
  },
];

/**
 * Start blank — no preset. Returns an empty section array.
 */
export function blankSections(): DraftSection[] {
  return [
    {
      title: '',
      questions: [
        {
          type: 'rating',
          label: '',
          required: true,
          scaleMax: 5,
          askOf: ['self', 'manager', 'peer'],
        },
      ],
    },
  ];
}
