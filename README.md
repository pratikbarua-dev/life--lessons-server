# Life Lessons API Server

This is the Express backend repository for the Life Lessons platform. It acts as the primary data and API provider for the client application, managing features from user authentication and admin controls, to premium lesson content via Stripe.

## Features

- **RESTful API Architecture:** Highly modular setup with isolated routes for lessons, users, favorites, reports, admin functionality, newsletters, and more.
- **Authentication & Authorization:** Secure endpoints using JWT verification alongside distinct Admin routing controls (`middlewares/verifyJWT.js`, `middlewares/adminauth.js`).
- **Premium Subscriptions:** Robust integration with Stripe, managing checkout sessions and listening to raw webhook events for payment success (`/api/webhook`).
- **Database Integrated:** Uses MongoDB native driver connected efficiently on server initialization.
- **Analytics & Reporting:** Specialized endpoints to gather user statistics such as Top Contributors and Most Saved Lessons, alongside an Admin dashboard backend route for platform metrics.

## Tech Stack

- **Node.js** & **Express.js (v5)**
- **MongoDB** Native Driver
- **Stripe** Integration (`stripe` npm package)
- **jose-cjs** for JWT Token Verification
- **dotenv** & **cors**

## Setup & Local Development

1. Clone the repository and navigate into it.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file at the root. You will need to add your specific MongoDB URI, Stripe Secret Keys, Stripe Webhook Secrets, etc.
4. Start the development server (runs on `http://localhost:3100` by default):
   ```bash
   npm start
   ```

## API Endpoints Overview

- `GET /ping` - Healthcheck
- `/api/lessons` - Manage content and lessons (CRUD operations, pagination)
- `/api/users` & `/users` - User registration, top contributors logic, metadata
- `/api/favorites` - Manage user favorites and most saved lessons
- `/api/admin` - Admin specific routes including analytics
- `/api/reports` - Handling flagged or reported content
- `/api/newsletter` - Newsletter subscription handling
- `/api/webhook` - Raw endpoint listening for Stripe events

## Project Structure

- `index.js`: Main entry point configuring Express, CORS, and mapping routes.
- `config/`: Configurations like MongoDB connection `db.js`.
- `routes/`: Modularized router files mapping to individual feature endpoints.
- `middlewares/`: Security handling, admin auth checking, and generic JWT middleware layers.
