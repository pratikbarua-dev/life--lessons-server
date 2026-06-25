const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { verifyJWT } = require('../middlewares/verifyJWT');

// POST /api/reports
router.post('/', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { lessonId, reporterUserId, reportedUserEmail, reason } = req.body;

    if (!lessonId || !reporterUserId || !reportedUserEmail || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required report details.' });
    }

    const newReport = {
      lessonId: new ObjectId(lessonId),
      reporterUserId,
      reportedUserEmail,
      reason, // e.g., "Inappropriate Content", "Harassment", "Spam"
      timestamp: new Date()
    };

    const result = await db.collection('lessonsReports').insertOne(newReport);

    res.status(201).json({
      success: true,
      message: 'Lesson has been flagged and submitted for admin review.',
      reportId: result.insertedId
    });

  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
