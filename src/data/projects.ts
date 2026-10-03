export interface ProjectEntry {
  title: string;
  description: string;
  tags: string[];
  date: string;
  url?: string;
  github?: string;
  association?: string;
}

export const projects: ProjectEntry[] = [
  {
    title: 'PEPFAR Funding Transition and PrEP Services in Hanoi',
    description: 'Interrupted time series analysis of seven years of records from a Hanoi sexual health clinic, estimating ~750 person-years of PrEP coverage lost after the 2025 PEPFAR/CDC funding transition and declines of 57% in visits, 61% in dispensing, and 65% in new initiations. Delivered a findings memo, a reproducible analysis repository with an automated audit script, and the clinic database\'s first data dictionary.',
    tags: ['R', 'REDCap', 'Interrupted Time Series', 'HIV Prevention'],
    date: 'Jun — Jul 2026',
    association: 'CREATA-H, Hanoi Medical University',
  },
  {
    title: 'BRFSS Insights',
    description: 'Diabetes risk estimation tool built on a logistic regression model of CDC BRFSS data. I designed the participant-facing survey flow and front end and deployed the Node.js prototype. Presented to NC DHHS leadership, leading to a proposed UNC–NC DHHS collaboration to develop and validate it further.',
    tags: ['Node.js', 'Vercel', 'Predictive Modeling', 'Most Creative Solution'],
    date: 'Spring 2026 — Present',
    association: 'UNC Gillings AI & Public Health Datathon',
  },
  {
    title: 'Bridging the Divide',
    description: 'Signature Work thesis analyzing 2,300+ USAID policy and program documents with BERTopic topic modeling to compare global health and development priorities across the Trump and Biden administrations. Found disease-specific bilateral programming dominant under Trump, with multilateral engagement and reproductive health expanding under Biden.',
    tags: ['Python', 'NLP', 'BERTopic', 'Policy Analysis'],
    date: 'Feb 2024 — Mar 2025',
    association: 'Duke Kunshan University',
  },
  {
    title: 'CliniCrush',
    description: 'Full-stack clinical trial matching platform built with React and Flask, featuring a custom eligibility algorithm querying 1,000+ trials from ClinicalTrials.gov. Built and deployed in 24 hours during HackDKU 2025.',
    tags: ['React', 'Flask', 'Healthcare', '1st Place — HackDKU 2025'],
    date: 'Apr 2025',
  },
];
