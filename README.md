# SmartFlow AI — VISTA Team 🚦

SmartFlow AI is an enterprise-grade B2G (Business-to-Government) web dashboard designed for an intelligent traffic enforcement system for the Jakarta Transportation Agency.

It handles real-time CCTV monitoring, AI-detected traffic violations (illegal parking, busway occupancy, bicycle lane invasion, etc.), ANPR (Automatic Number Plate Recognition) results, geospatial mapping, and reporting for E-TLE integration.

## Features
- **Real-Time Dashboard**: Total violations, AI confidence statistics, live camera feeds, and real-time detection notifications.
- **Violation Management**: Advanced data grid to filter, view, and process AI-detected traffic violations.
- **Geospatial Hotspots**: Leaflet-powered heatmaps with adjustable layers and predictive insights.
- **CCTV Monitoring**: Grid monitoring of connected traffic cameras, including connection status and uptime metrics.
- **E-TLE Integration**: Export workflows and system synchonization readiness.
- **Role-Based Auth**: Secure authorization for System Admins, Field Officers, and Viewers via NextAuth.

## Tech Stack
- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS (v4), Framer Motion, Recharts, React-Leaflet
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: PostgreSQL (Prisma ORM)
- **Deployment**: Docker, docker-compose

## Quick Start

1. **Clone & Install**
   ```bash
   git clone <repository>
   cd smartflow-ai
   npm install
   ```

2. **Environment Variables**
   Copy `.env.local.example` to `.env` and `.env.local`:
   ```bash
   cp .env.local.example .env.local
   cp .env.local.example .env
   ```

3. **Start Database (Docker)**
   Start the PostgreSQL database via docker-compose:
   ```bash
   docker-compose up -d db
   ```

4. **Initialize Database**
   Push the Prisma schema to the database and generate the client:
   ```bash
   npx prisma generate
   npm run db:push
   ```

5. **Seed Mock Data**
   Populate the database with realistic traffic violation mock data:
   ```bash
   npm run db:seed
   ```

6. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## API Endpoints
- `GET /api/violations` - Paginated traffic violations
- `GET /api/violations/[id]` - Specific violation detail
- `PATCH /api/violations/[id]` - Update violation status
- `GET /api/cameras` - Camera status and daily violations
- `GET /api/analytics` - System metrics and history
- `GET /api/heatmap` - Geospatial violation points
- `GET /api/export` - PDF/CSV export simulation

## Team Info
Developed rapidly by **VISTA** (President University) for modernizing Jakarta's intelligent transportation monitoring.
