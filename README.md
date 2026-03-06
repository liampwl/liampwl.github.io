# liampwl.com

Personal portfolio website for **Liam Powell**.

🔗 **Live site:** [liampwl.com](https://liampwl.com)

## About

This site serves as a hub for my professional experience, selected projects, and contact information. It features sections on my work with organizations like USAID, FHI 360, and The Water Institute at UNC, as well as projects spanning NLP-driven policy analysis, full-stack health tech, and nonprofit design.

## Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Framework   | [Astro](https://astro.build/) v5    |
| Language    | TypeScript                          |
| Styling     | Vanilla CSS (custom properties)     |
| Hosting     | GitHub Pages (static output)        |
| Images      | `astro:assets` + Sharp (WebP)       |

## Project Structure

```
src/
├── components/     # Astro components (Hero, Nav, Projects, etc.)
├── data/           # TypeScript data files for experience, projects, and socials
├── layouts/        # Base HTML layout
├── pages/          # Route entry points
└── styles/         # Global CSS and theme tokens
public/             # Static assets (favicon, resume, CNAME)
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

## Deployment

The site is deployed to **GitHub Pages** via the `CNAME` file pointing to `liampwl.com`. Pushing to the main branch triggers a build and deploy through the GitHub Actions workflow.