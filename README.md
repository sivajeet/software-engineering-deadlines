# Software Engineering Deadlines

An information-focused website for upcoming software engineering conference
deadlines and journal calls for papers.

## Features

- Automatically hides passed deadlines using the visitor's local date
- Shows the current month and the next three months
- Groups conference tracks that share a paper deadline
- Keeps abstract and paper deadlines together in the deadline list
- Filters conferences by continent, country, ICORE rank, and track
- Separates journal calls visually and lists continuous calls last
- Highlights the next conference and journal submission deadlines
- Includes only paper tracks with a minimum length of eight pages

Conference data is stored in `app/venues.json`. Journal calls are stored in
`app/journals.json`.

## Local Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Validation

```bash
npm run build
npm run lint
```

## Data Maintenance

Deadline information can change after publication. Verify dates, tracks,
locations, page limits, and call status against the official venue or journal
call before updating either JSON file.
