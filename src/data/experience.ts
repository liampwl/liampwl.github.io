export interface ExperienceEntry {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  description: string;
  tags: string[];
}

export const experience: ExperienceEntry[] = [
  {
    organization: 'The Water Institute at UNC',
    role: 'Work-Study Student, Healthcare Facilities Team',
    dateRange: 'Sep 2025 — Present',
    location: 'Chapel Hill, NC',
    description: 'Managing two global Communities of Practice with 1,000+ members, coordinating webinars on circuit rider interventions and WASH in healthcare facilities. Conducting systematic synthesis of 2,000+ pages of programmatic reports for World Vision\'s evaluation in Niger.',
    tags: ['WASH', 'Global Health', 'Research'],
  },
  {
    organization: 'FHI 360',
    role: 'Stanback Fellow, Research & Knowledge Management — WASH',
    dateRange: 'May — Aug 2024',
    location: 'Durham, NC',
    description: 'Supported global hygiene implementation through the Global Handwashing Partnership. Co-developed the Just Ask initiative, piloting AI-assisted microlearning tools to translate peer-reviewed evidence into field-ready guidance.',
    tags: ['Behavior Change', 'WASH', 'Knowledge Management'],
  },
  {
    organization: 'USAID',
    role: 'Student Trainee, Bureau for Global Health — Office of HIV/AIDS',
    dateRange: 'May — Aug 2023',
    location: 'Washington, DC',
    description: 'Conducted compliance reviews for $2M+ in HIV/AIDS subawards across 20+ country teams. Supported implementation of global mechanisms and contributed to the design of OHA-wide orientation for incoming coordinators.',
    tags: ['HIV/AIDS', 'PEPFAR', 'Policy'],
  },
  {
    organization: 'Pathfinders for Greenways',
    role: 'Marketing Consultant',
    dateRange: 'Aug 2021 — Present',
    location: 'Roanoke, VA',
    description: 'Leading donor communications strategy contributing to $120k+ in annual fundraising. Designing and distributing 4,000+ donor newsletters annually and managing multi-channel campaign communications.',
    tags: ['Nonprofit', 'Design', 'Communications'],
  },
];
