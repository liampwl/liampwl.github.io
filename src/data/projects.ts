export interface ProjectEntry {
  title: string;
  description: string;
  tags: string[];
  date: string;
  url?: string;
  github?: string;
  association?: string;
  award?: string;
  post?: string;
  /** Internal write-up page, e.g. '/hanoi/' */
  page?: string;
  /** Poster PDF under public/ */
  poster?: string;
}

export const projects: ProjectEntry[] = [
  {
    title: 'PEPFAR Funding Withdrawal and PrEP Services in Hanoi',
    description: 'Negative-binomial interrupted time series analysis of seven years of records from a Hanoi sexual health clinic (86 monthly observations, ~11,000 clients), estimating the effect of the 2025 PEPFAR/CDC funding withdrawal on PrEP initiation, medication dispensing, and service use in an MSM-predominant population. Isolated the funding effect from a concurrent research cohort that would have masked it. Delivered a results memo, a reproducible analysis repository, and a share-out to clinic leadership, CDC, and CREATA-H investigators, informed by key-informant conversations with clinicians and program staff.',
    tags: ['R', 'REDCap', 'Interrupted Time Series', 'HIV Prevention'],
    date: 'Jun — Jul 2026',
    association: 'CREATA-H, Hanoi Medical University',
    award: 'Practicum Excellence Award, 2026',
    page: '/hanoi/',
    poster: '/posters/hanoi-prep-practicum-day-2026.pdf',
    post: 'https://tarheels.live/globalhealth/2026/10/01/serious-work-silly-coffee-wrapping-up-in-hanoi/',
  },
  {
    title: 'BRFSS Insights',
    description: 'Diabetes risk estimation tool built on a logistic regression model of CDC BRFSS data. I designed the participant-facing survey flow and front end and deployed the Node.js prototype. Presented to NC DHHS leadership, leading to a proposed UNC–NC DHHS collaboration to develop and validate it further. Accepted to present a poster on generative AI for people-centered public health tools at the 2026 NC Global Health Conference.',
    tags: ['Node.js', 'Vercel', 'Predictive Modeling'],
    date: 'Spring 2026 — Present',
    association: 'UNC Gillings AI & Public Health Datathon',
    award: 'Most Creative Solution',
    url: 'https://gillings-datathon.vercel.app',
    github: 'https://github.com/liampwl/gillings-datathon',
    poster: '/posters/brfss-insights-ncghc-2026.pdf',
  },
  {
    title: 'Bridging the Divide',
    description: 'Signature Work thesis analyzing 2,300+ USAID policy and program documents with BERTopic topic modeling to compare global health and development priorities across the Trump and Biden administrations. Found disease-specific bilateral programming dominant under Trump, with multilateral engagement and reproductive health expanding under Biden.',
    tags: ['Python', 'NLP', 'BERTopic', 'Policy Analysis'],
    date: 'Feb 2024 — Mar 2025',
    association: 'Duke Kunshan University',
    github: 'https://github.com/liampwl/signature-work',
  },
  {
    title: 'CliniCrush',
    description: 'Full-stack clinical trial matching platform built with React and Flask, featuring a custom eligibility algorithm querying 1,000+ trials from ClinicalTrials.gov. Built and deployed in 24 hours during HackDKU 2025.',
    tags: ['React', 'Flask', 'Healthcare'],
    date: 'Apr 2025',
    award: '1st Place, HackDKU 2025',
  },
];
