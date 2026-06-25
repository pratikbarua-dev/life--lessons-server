const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

// Middleware to get the logged-in user with their DB profile attached
const { verifyJWT } = require('../middlewares/verifyJWT');

router.post('/api/create-checkout-session', verifyJWT, async (req, res) => {
    try {
        const { priceId } = req.body;
        const user = req.user; // from auth middleware

        // Use the Stripe Customer ID stored in your DB (Better Auth saves it as stripeCustomerId)
        const customerId = user.stripeCustomerId;

        // Use BETTER_AUTH_URL from your .env as the frontend base URL
        const clientUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

        const sessionConfig = {
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'payment', // or 'subscription' depending on your price ID type
            success_url: `${clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/canceled`,
            metadata: {
                userId: user._id.toString(), // so we know who paid
            },
        };

        // If the user already has a Stripe customer ID, use it.
        // Otherwise, use their email to link or create a new customer during checkout.
        if (customerId) {
            sessionConfig.customer = customerId;
        } else if (user.email) {
            sessionConfig.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ sessionId: session.id, url: session.url });
    } catch (err) {
        console.error("Stripe Checkout Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/verify-checkout-session?session_id=...
router.get('/api/verify-checkout-session', verifyJWT, async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({ error: "Missing session_id" });
        }

        // Retrieve the session from Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status === 'paid') {
            const userId = session.metadata.userId;
            
            // Verify that the user claiming the session matches the logged-in user
            if (userId !== req.user._id.toString()) {
                return res.status(403).json({ error: "Unauthorized session claim" });
            }

            const db = getDb();
            const usersCollection = db.collection('user');

            // Upgrade user to premium
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: { isPremium: true } }
            );

            return res.json({ success: true, isPremium: true });
        } else {
            return res.json({ success: false, payment_status: session.payment_status });
        }
    } catch (err) {
        console.error("Stripe Verification Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;