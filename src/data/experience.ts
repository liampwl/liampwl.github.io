export interface ExperienceEntry {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  description: string;
}

export const experience: ExperienceEntry[] = [
  {
    organization: 'Hanoi Medical University',
    role: 'MPH Practicum Intern',
    dateRange: 'Jun — Jul 2026',
    location: 'Hanoi, Vietnam',
    description: 'Conducting practicum research on disruptions to HIV prevention service delivery at a clinic affiliated with Hanoi Medical University, examining how global funding and policy shifts reach the front lines of care.',
  },
  {
    organization: 'The Water Institute at UNC',
    role: 'Work-Study Student, Healthcare Facilities Team',
    dateRange: 'Sep 2025 — Present',
    location: 'Chapel Hill, NC',
    description: 'Managing two global Communities of Practice with 1,000+ members, coordinating webinars on circuit rider interventions and WASH in healthcare facilities. Synthesizing 2,000+ pages of programmatic reports into a longitudinal database for World Vision\'s "Act to Save" evaluation in Niger.',
  },
  {
    organization: 'FHI 360',
    role: 'Stanback Fellow, Research & Knowledge Management — WASH',
    dateRange: 'May — Aug 2024',
    location: 'Durham, NC',
    description: 'Supported global hygiene implementation through the Global Handwashing Partnership. Co-developed the Just Ask initiative, piloting AI-assisted microlearning tools to translate peer-reviewed evidence into field-ready guidance.',
  },
  {
    organization: 'USAID',
    role: 'Student Trainee, Bureau for Global Health — Office of HIV/AIDS',
    dateRange: 'May — Aug 2023',
    location: 'Washington, DC',
    description: 'Conducted compliance reviews for $2M+ in HIV/AIDS subawards across 20+ country teams under PEPFAR. Supported global mechanisms like EpiC and helped design the Office-wide orientation for incoming Country Operational Plan coordinators.',
  },
  {
    organization: 'Pathfinders for Greenways',
    role: 'Marketing Consultant',
    dateRange: 'Aug 2021 — Present',
    location: 'Roanoke, VA',
    description: 'Leading donor communications strategy contributing to $120k+ in annual fundraising. Designing and distributing 4,000+ donor newsletters annually.',
  },
];
