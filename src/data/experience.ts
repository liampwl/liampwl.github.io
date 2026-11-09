export interface ExperienceEntry {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  description: string;
}

export const experience: ExperienceEntry[] = [
  {
    organization: 'The Graduate School at UNC',
    role: 'Graduate Research Assistant, Graduate Funding and Information Center',
    dateRange: 'Sep 2026 — Present',
    location: 'Chapel Hill, NC',
    description: 'Writing and sending Funding and Fellowships Friday, the center\'s iContact newsletter to about 8,000 subscribers; rebuilt its email templates. Also running funding searches and database reviews, one-on-one funding consultations with students, and funding workshops for fellowship cohorts and classes.',
  },
  {
    organization: 'The Water Institute at UNC',
    role: 'Graduate Work-Study Student, Communities of Practice',
    dateRange: 'Sep 2025 — May 2026; Aug 2026 — Present',
    location: 'Chapel Hill, NC',
    description: 'Coordinating webinar production for two global communities of practice (~1,300 subscribers in 50+ countries), from speaker outreach and Mailchimp campaigns to Zoom logistics and recordings; increased average WASH in healthcare facilities webinar attendance by 50%. Helped launch the WASH Circuit Riders Community of Practice, including washcircuitriders.org, a subscriber list grown from 0 to 297, and a bimonthly webinar series. Rewrote both communities\' SOPs into AI-ready guides with tool-agnostic prompts, and refreshed their logos and slide templates.',
  },
  {
    organization: 'Center for Research and Training on Substance Use-HIV, Hanoi Medical University',
    role: 'MPH Practicum Intern, Sexual Health Promotion Clinic',
    dateRange: 'Jun — Jul 2026',
    location: 'Hanoi, Vietnam',
    description: 'Designed and ran a negative-binomial interrupted time series analysis of seven years of clinic records (86 monthly observations, ~11,000 clients) to estimate the effect of the 2025 PEPFAR/CDC funding withdrawal on PrEP initiation, medication dispensing, and service use in an MSM-predominant population. Built the R pipeline from raw REDCap exports, reconstructing the clinic\'s own Stata reporting definitions to reproduce its internal monthly counts exactly, and shared the results with clinic leadership, CDC, and CREATA-H investigators.',
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
