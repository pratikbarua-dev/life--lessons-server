const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { verifyJWT } = require('../middlewares/verifyJWT');

// POST /api/favorites/toggle
router.post('/toggle', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { userId, lessonId } = req.body;

    if (!userId || !lessonId) {
      return res.status(400).json({ success: false, message: 'Missing userId or lessonId.' });
    }

    const favoritesCollection = db.collection('favorites');

    // Check if this bookmark already exists
    const existingFavorite = await favoritesCollection.findOne({ userId, lessonId });

    if (existingFavorite) {
      // 1. If it exists, remove it (Unfavorite)
      await favoritesCollection.deleteOne({ userId, lessonId });
      return res.status(200).json({ 
        success: true, 
        isFavorited: false, 
        message: 'Removed from favorites.' 
      });
    } else {
      // 2. If it does not exist, insert it (Favorite)
      const newFavorite = {
        userId,
        lessonId,
        savedAt: new Date()
      };
      await favoritesCollection.insertOne(newFavorite);
      return res.status(201).json({ 
        success: true, 
        isFavorited: true, 
        message: 'Saved to favorites! 🔖' 
      });
    }

  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
