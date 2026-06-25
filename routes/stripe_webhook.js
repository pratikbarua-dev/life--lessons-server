const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

// This route receives the raw body (configured in index.js)
router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
            try {
                const db = getDb();
                // Find the user and set isPremium to true
                await db.collection('user').updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { isPremium: true } }
                );
                console.log(`Successfully upgraded user ${userId} to Premium!`);
            } catch (dbError) {
                console.error("Database Error upgrading user:", dbError);
                return res.status(500).send("Database error");
            }
        } else {
            console.warn("No userId found in session metadata");
        }
    }

    res.json({ received: true });
});

module.exports = router;
