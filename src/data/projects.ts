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
    title: 'PEPFAR Funding Terminations and PrEP Services in Hanoi',
    description: 'Mixed-methods practicum study combining an interrupted time series of clinic program data with staff interviews to measure how the October 2025 PEPFAR terminations disrupted PrEP enrollment and retention among MSM at a Hanoi sexual health clinic.',
    tags: ['Interrupted Time Series', 'Qualitative Interviews', 'HIV Prevention', 'Vietnam'],
    date: 'Jun — Jul 2026',
    association: 'CREATA-H, Hanoi Medical University',
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
  {
    title: 'Global Handwashing Day 2024',
    description: 'Designed campaign materials including fact sheets, social media toolkits, infographics, and calls to action for the 2024 Global Handwashing Day initiative.',
    tags: ['Graphic Design', 'Health Advocacy', 'Campaign Strategy'],
    date: 'May — Aug 2024',
    association: 'FHI 360',
  },
];
