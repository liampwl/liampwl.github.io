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
    title: 'CliniCrush',
    description: 'Full-stack clinical trial matching platform built with React and Flask, featuring a custom eligibility algorithm querying 1,000+ trials from ClinicalTrials.gov. Built and deployed in 24 hours during HackDKU 2025.',
    tags: ['React', 'Flask', 'Healthcare', '1st Place — HackDKU 2025'],
    date: 'Apr 2025',
    github: 'https://github.com/liampwl',
  },
  {
    title: 'Bridging the Divide',
    description: 'Signature Work thesis analyzing 2,300+ USAID policy documents using BERTopic topic modeling to compare global health priorities across the Trump and Biden administrations. Identified shifts toward localization and health systems strengthening.',
    tags: ['Python', 'NLP', 'BERTopic', 'Policy Analysis'],
    date: 'Feb 2024 — Mar 2025',
    association: 'Duke Kunshan University',
  },
  {
    title: 'Global Handwashing Day 2024',
    description: 'Designed campaign materials including fact sheets, social media toolkits, infographics, and calls to action for the 2024 Global Handwashing Day initiative.',
    tags: ['Graphic Design', 'Health Advocacy', 'Campaign Strategy'],
    date: 'May — Aug 2024',
    association: 'FHI 360',
  },
  {
    title: 'Pathfinders for Greenways Newsletters',
    description: 'Annual donor newsletters designed and distributed to 4,000+ supporters, supporting organizational sustainability and donor engagement for a regional greenway advocacy nonprofit.',
    tags: ['InDesign', 'Nonprofit Marketing', 'Graphic Design'],
    date: '2021 — Present',
    association: 'Pathfinders for Greenways',
  },
  {
    title: 'Text-as-Data in Judicial Politics',
    description: 'Bibliographical research on text-as-data approaches in judicial politics for Prof. Jason Todd, covering document classifiers, topic models, and sentiment analysis studies from 2016–2024.',
    tags: ['Literature Review', 'LaTeX', 'Political Science'],
    date: 'Sep 2024',
    association: 'Duke Kunshan University',
  },
];
