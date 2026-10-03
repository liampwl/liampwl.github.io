export interface ExperienceEntry {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  description: string;
}

export const experience: ExperienceEntry[] = [
  {
    organization: 'The Water Institute at UNC',
    role: 'Graduate Work-Study Student, Communities of Practice',
    dateRange: 'Sep 2025 — Present',
    location: 'Chapel Hill, NC',
    description: 'Coordinating webinar production for two global professional communities (1,000+ members across 50+ countries), from stakeholder outreach and communications campaigns to event logistics; increased average WASH in healthcare facilities webinar attendance by 50%. Helped launch the Circuit Riders Community of Practice, including washcircuitriders.org, a subscriber base grown from 0 to 297, and a bimonthly webinar series.',
  },
  {
    organization: 'Center for Research and Training on Substance Use-HIV, Hanoi Medical University',
    role: 'MPH Practicum Intern, Global Health',
    dateRange: 'Jun — Jul 2026',
    location: 'Hanoi, Vietnam',
    description: 'Designed and ran an interrupted time series analysis of seven years of clinic records, estimating ~750 person-years of PrEP coverage lost after the 2025 PEPFAR/CDC funding transition, with post-transition declines of 57% in service visits and 65% in new PrEP initiations. Built the R pipeline from raw REDCap exports and presented findings to clinic leadership and U.S. CDC staff in Hanoi.',
  },
  {
    organization: 'FHI 360',
    role: 'Stanback Fellow, Research & Knowledge Management — WASH',
    dateRange: 'May — Aug 2024',
    location: 'Durham, NC',
    description: 'Developed resources for the Just Ask microlearning initiative and wrote a ChatGPT-assisted drafting procedure with citation verification and technical review steps. Developed Global Handwashing Day campaign materials and reviewed a hand-hygiene research summary for accurate interpretation of findings.',
  },
  {
    organization: 'USAID',
    role: 'Student Trainee, Bureau for Global Health — Office of HIV/AIDS',
    dateRange: 'May — Aug 2023',
    location: 'Washington, DC',
    description: 'Conducted compliance reviews for $2M+ in HIV/AIDS subawards across 20+ country teams under PEPFAR. Coordinated technical inputs for Country Operational Plans and key population programming under EpiC, and helped design the Office-wide orientation for incoming COP coordinators and medical officers.',
  },
  {
    organization: 'Pathfinders for Greenways',
    role: 'Marketing Consultant',
    dateRange: 'Aug 2021 — Present',
    location: 'Roanoke, VA',
    description: 'Leading donor communications for a regional greenway nonprofit, contributing to $120k+ in annual fundraising. Designing and distributing 4,000+ donor newsletters annually.',
  },
];
