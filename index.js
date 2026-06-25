require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./config/db');

// Import routes
const newsletterRoutes = require('./routes/newsletter');
const lessonsRoutes = require('./routes/lessons');
const usersRoutes = require('./routes/users');
const favoritesRoutes = require('./routes/favorites');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const stripeRoutes = require('./routes/stripe');

const app = express();
app.use(cors());

// Stripe Webhook needs raw body, not JSON
const webhookRoute = require('./routes/stripe_webhook');
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRoute);

app.use(express.json());
const port = 3100;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Use routes
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/users', usersRoutes);           // GET /users
app.use('/api/users', usersRoutes);       // For other /api/users routes
app.use('/api/favorites', favoritesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use(stripeRoutes);
// Start server
connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
});