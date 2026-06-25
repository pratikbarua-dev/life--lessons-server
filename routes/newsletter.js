const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');

//NewsLetter Subscribers
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Basic validation
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email address is required.' 
      });
    }

    // Simple regex validation for email structure
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address.' 
      });
    }

    // 2. Connect to Database using native driver
    const db = getDb();
    const newsletterCollection = db.collection('newsletter');

    // 3. Check for existing subscription to prevent duplicates
    const existingSubscriber = await newsletterCollection.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (existingSubscriber) {
      return res.status(409).json({ 
        success: false, 
        message: 'This email is already subscribed to our newsletter!' 
      });
    }

    // 4. Insert new subscription document
    const newSubscription = {
      email: email.toLowerCase().trim(),
      subscribedAt: new Date()
    };

    const result = await newsletterCollection.insertOne(newSubscription);

    if (result.insertedId) {
      return res.status(201).json({
        success: true,
        message: 'Successfully subscribed to the newsletter! 🎉'
      });
    } else {
      throw new Error('Database insertion failed');
    }

  } catch (error) {
    console.error('Newsletter Subscription Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again later.' 
    });
  }
});

module.exports = router;
