const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// Import the middleware
const { verifyJWT, verifyJWTAllowBanned } = require('../middlewares/verifyJWT');


router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const users = await db.collection('user').find().toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/users/me/status
router.get('/me/status', verifyJWTAllowBanned, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user._id || req.user.id;
    
    // Check if the user is banned
    const isBanned = req.user.banned || req.user.isBanned || false;
    
    // Check for existing pending appeals
    const activeAppeal = await db.collection('appeals').findOne({ 
      userId: new ObjectId(userId),
      status: 'pending' 
    });

    res.json({
      success: true,
      data: {
        isBanned,
        appealStatus: activeAppeal ? activeAppeal.status : null
      }
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/users/appeal
router.post('/appeal', verifyJWTAllowBanned, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user._id || req.user.id;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Appeal reason is required' });
    }

    // Check if already appealed
    const existingAppeal = await db.collection('appeals').findOne({
      userId: new ObjectId(userId),
      status: 'pending'
    });

    if (existingAppeal) {
      return res.status(400).json({ success: false, message: 'You already have a pending appeal.' });
    }

    const appeal = {
      userId: new ObjectId(userId),
      reason,
      status: 'pending',
      createdAt: new Date()
    };

    await db.collection('appeals').insertOne(appeal);

    res.json({ success: true, message: 'Appeal submitted successfully.' });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

//My Lessons Route
router.get('/:userId/lessons', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;
    // Ensure the user is only fetching their OWN lessons.
    // Assuming the JWT payload contains the user's ID as `req.user.id` or `req.user._id`
    if (req.user.id !== userId && req.user._id?.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own lessons' });
    }
    const myLessons = await db.collection('lessons')
      .find({ creatorId: new ObjectId(userId) })
      .sort({ _id: -1 }) // Newest first
      .toArray();

    res.json({ success: true, data: myLessons });
  } catch (error) {
    console.error('Error fetching user lessons:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

router.get('/:userId/drafts', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;
    // Ensure the user is only fetching their OWN lessons.
    // Assuming the JWT payload contains the user's ID as `req.user.id` or `req.user._id`
    if (req.user.id !== userId && req.user._id?.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own lessons' });
    }
    const drafts = await db.collection('lessons')
      .find({
        creatorId: new ObjectId(userId),
        visibility: 'Private'
      })
      .sort({ _id: -1 })
      .toArray();

    res.json({ success: true, data: drafts });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

router.get('/:userId/favorites', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;
    // Ensure the user is only fetching their OWN lessons.
    // Assuming the JWT payload contains the user's ID as `req.user.id` or `req.user._id`
    if (req.user.id !== userId && req.user._id?.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own lessons' });
    }
    // Use MongoDB pipeline aggregation to join favorites table entries with actual lesson metadata
    const favoriteLessons = await db.collection('favorites').aggregate([
      { $match: { userId: userId } }, // Find all rows bookmarked by this user string/id
      {
        $lookup: {
          from: 'lessons',
          let: { targetLessonId: { $toObjectId: "$lessonId" } }, // Cast matching reference strings smoothly
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$targetLessonId"] } } }
          ],
          as: 'lessonDetails'
        }
      },
      { $unwind: '$lessonDetails' }, // Flatten lookup array results directly inside response row
      { $sort: { savedAt: -1 } }     // Show recently bookmarked items first
    ]).toArray();

    res.json({ success: true, data: favoriteLessons });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
router.get('/:userId/stats', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.params;
    // Ensure the user is only fetching their OWN lessons.
    // Assuming the JWT payload contains the user's ID as `req.user.id` or `req.user._id`
    if (req.user.id !== userId && req.user._id?.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own lessons' });
    }
    const userObjectId = new ObjectId(userId);
    const lessonCollection = db.collection('lessons');

    // 1. Get total lessons count and public count for the user
    const userLessons = await lessonCollection.find({ creatorId: userObjectId }).toArray();
    const totalLessons = userLessons.length;
    const publicLessons = userLessons.filter(l => l.visibility === 'Public').length;

    // 2. Calculate Total Engagement (Sum of likesCount across all user's lessons)
    const totalEngagement = userLessons.reduce((acc, lesson) => acc + (lesson.likesCount || 0), 0);

    // 3. Determine "Public Footprint" percentage
    const footprint = totalLessons > 0 ? Math.round((publicLessons / totalLessons) * 100) : 0;

    // 4. Determine Rank (Logic based on your requirements)
    let rank = 'Novice';
    if (totalEngagement >= 5000) rank = 'Stoic Master';
    else if (totalEngagement >= 1000) rank = 'Philosopher';

    // 5. Calculate Top Lessons by Engagement
    const topLessons = userLessons
      .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      .slice(0, 5)
      .map(l => ({
        title: l.title.length > 20 ? l.title.substring(0, 20) + '...' : l.title,
        likes: l.likesCount || 0
      }));

    res.json({
      success: true,
      data: {
        totalEngagement,
        totalLessons,
        publicFootprintPercentage: footprint,
        rank,
        topLessons
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error calculating stats' });
  }
});

// PATCH /api/users/:id/profile
router.patch('/:id/profile', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    // Ensure the user is only fetching their OWN lessons.
    // Assuming the JWT payload contains the user's ID as `req.user.id` or `req.user._id`
    if (req.user.id !== id && req.user._id?.toString() !== id) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own lessons' });
    }
    const { name, photoURL } = req.body; // Only extract fields allowed to be updated

    const updateFields = {};
    if (name) updateFields.name = name;
    if (photoURL) updateFields.photoURL = photoURL;

    // Guardrail: Ensure at least one valid field is being modified
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid name or photoURL to update.'
      });
    }

    const result = await db.collection('user').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully! ✨'
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
