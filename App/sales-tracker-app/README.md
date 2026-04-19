# Sales Tracker App

A modern, mobile-responsive sales tracking application built with Next.js, React, and Recharts. Track proposals, win rates, pipeline values, and more with real-time analytics and Google Sheets integration.

## Features

- **Dashboard**: KPI cards, status distribution charts, and pipeline visualizations
- **Proposal Tracker**: Add, edit, and manage sales proposals with status tracking
- **Google Sheets Integration**: Sync data with Google Sheets for collaborative tracking
- **Import/Export**: Excel file support for bulk data operations
- **Dark/Light Mode**: Theme toggle for comfortable viewing
- **Mobile-First Design**: Optimized for mobile devices with responsive UI
- **Local Storage**: Data persistence in browser storage

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React with custom CSS variables for theming
- **Charts**: Recharts for data visualization
- **Data Handling**: XLSX for Excel import/export
- **Styling**: Tailwind CSS for responsive design
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sales-tracker-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Usage

### Adding Proposals

1. Tap the "Add" tab in the bottom navigation
2. Fill in proposal details: number, status, cost, markup, win rate, revisions, comments
3. Status auto-updates based on win rate and revisions
4. Save to add to the tracker

### Google Sheets Integration

1. Go to the "Sheets" tab
2. Enter your Google Sheets ID and API Key
3. For read-only access, use the published CSV URL
4. Enable auto-sync for real-time updates

### Importing Data

1. Go to the "Files" tab
2. Upload an Excel file with the required headers
3. Data is parsed and added to the tracker

### Exporting Data

1. Go to the "Files" tab
2. Tap "Download" to export all data and computed fields to Excel

## Data Structure

Each proposal includes:
- **Proposal #**: Unique identifier
- **Status**: Win, Loss, Negotiation, On-bidding, Revision
- **Cost**: Base cost in PHP
- **Markup**: Percentage markup (e.g., 0.25 for 25%)
- **Revisions**: Additional costs
- **Win Rate**: Probability of winning (0-1)
- **Comments**: Notes and client details

Computed fields:
- **Revenue**: Cost + Markup Value (for wins)
- **Pipeline Value**: Cost for active proposals
- **Markup Value**: Cost × Markup

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Deploy automatically on push
3. Custom domains can be configured in Vercel dashboard

### Custom Domains

For the specified domains:
- sales-tracker-app-alpha.vercel.app
- sales-tracker-3dg0awt63.vercel.app

Configure in Vercel project settings under "Domains".

## Configuration

### Google Sheets Setup

1. Create a Google Sheet with the following columns:
   - Status
   - Proposal #
   - Cost Proposal (₱)
   - Markup %
   - Revisions (₱)
   - Win Rate
   - Comments

2. Share the sheet publicly (for read access)
3. Enable Google Sheets API in Google Cloud Console
4. Create an API Key
5. Copy the Sheet ID from the URL

### Environment Variables

No environment variables required for basic functionality. For production deployments, consider adding:
- Google API credentials (if needed)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
