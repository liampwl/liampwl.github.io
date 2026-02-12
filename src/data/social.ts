export interface SocialLink {
  name: string;
  url: string;
  icon: string;
  label: string;
}

export const socialLinks: SocialLink[] = [
  {
    name: 'cv',
    url: '/resume.pdf',
    icon: 'cv',
    label: 'Download CV',
  },
  {
    name: 'email',
    url: 'mailto:william.powell@unc.edu',
    icon: 'email',
    label: 'Email',
  },
  {
    name: 'github',
    url: 'https://github.com/liampwl',
    icon: 'github',
    label: 'GitHub',
  },
  {
    name: 'linkedin',
    url: 'https://linkedin.com/in/williampwl',
    icon: 'linkedin',
    label: 'LinkedIn',
  },
  {
    name: 'instagram',
    url: 'https://instagram.com/liam.pwl',
    icon: 'instagram',
    label: 'Instagram',
  },
];
