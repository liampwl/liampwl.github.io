export interface ExperienceEntry {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  description: string;
}

export const experience: ExperienceEntry[] = [
  {
    organization: 'Center for Research and Training on Substance Use-HIV, Hanoi Medical University',
    role: 'MPH Practicum Intern, Global Health',
    dateRange: 'Jun — Jul 2026',
    location: 'Hanoi, Vietnam',
    description: 'Ran an interrupted time series analysis of longitudinal data from a Hanoi sexual health clinic to assess how the October 2025 PEPFAR funding terminations affected PrEP enrollment and client retention among MSM. Led qualitative interviews with clinic staff on changes to referral networks, outreach, and care-seeking, and reported findings to clinic leadership at CREATA-H.',
  },
  {
    organization: 'The Water Institute at UNC',
    role: 'Work-Study Student, Healthcare Facilities Team',
    dateRange: 'Sep 2025 — May 2026',
    location: 'Chapel Hill, NC',
    description: 'Ran webinar production for two global Communities of Practice (1,000+ members across 50+ countries), raising WASH in healthcare facilities webinar attendance by roughly half. Built the Circuit Riders Community of Practice from scratch, including washcircuitriders.org and a subscriber base grown from 0 to nearly 300. Synthesized 2,000+ pages of program reports into a longitudinal database for World Vision\'s "Act to Save" evaluation in Niger.',
  },
  {
    organization: 'FHI 360',
    role: 'Stanback Fellow, Research & Knowledge Management — WASH',
    dateRange: 'May — Aug 2024',
    location: 'Durham, NC',
    description: 'Produced technical resources and donor-facing materials for the Global Handwashing Partnership with partners including USAID, UNICEF, and the World Bank. Helped develop the Just Ask initiative, piloting AI-assisted microlearning tools to translate hygiene evidence into field-ready guidance.',
  },
  {
    organization: 'USAID',
    role: 'Student Trainee, Bureau for Global Health — Office of HIV/AIDS',
    dateRange: 'May — Aug 2023',
    location: 'Washington, DC',
    description: 'Conducted compliance reviews for $2M+ in HIV/AIDS subawards across 20+ country teams under PEPFAR. Coordinated technical inputs for Country Operational Plans and key population programming under global mechanisms like EpiC, and helped design the Office-wide orientation for incoming COP coordinators and medical officers.',
  },
  {
    organization: 'Pathfinders for Greenways',
    role: 'Marketing Consultant',
    dateRange: 'Aug 2021 — Present',
    location: 'Roanoke, VA',
    description: 'Leading donor communications for a regional greenway nonprofit, contributing to $120k+ in annual fundraising. Designing and distributing 4,000+ donor newsletters annually.',
  },
];
