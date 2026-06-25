const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { verifyJWT } = require('../middlewares/verifyJWT');
const { verifyAdmin } = require('../middlewares/adminauth');

// GET /api/admin/stats
router.get('/stats', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const usersCount = await db.collection('user').countDocuments();
    const publicLessonsCount = await db.collection('lessons').countDocuments({ visibility: 'Public' });
    const privateLessonsCount = await db.collection('lessons').countDocuments({ visibility: 'Private' });
    const totalReportsCount = await db.collection('lessonsReports').countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: usersCount,
        publicLessons: publicLessonsCount,
        privateLessons: privateLessonsCount,
        reportedLessons: totalReportsCount
      }
    });
  } catch (error) {
    console.error('Error compiling dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { role } = req.body; // Expects "user" or "admin"

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role configuration value.' });
    }

    const result = await db.collection('user').updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User reference row not found.' });
    }

    res.status(200).json({ success: true, message: `User role changed successfully to ${role}.` });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/admin/lessons/:id/feature
router.patch('/lessons/:id/feature', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { isFeatured } = req.body; // Expects true or false

    const result = await db.collection('lessons').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isFeatured: Boolean(isFeatured) } }
    );

    res.status(200).json({ 
      success: true, 
      message: isFeatured ? 'Lesson marked as Featured.' : 'Lesson removed from Featured items.' 
    });
  } catch (error) {
    console.error('Error toggling featured state:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/admin/reports
router.get('/reports', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const reports = await db.collection('lessonsReports')
      .find()
      .sort({ timestamp: -1 })
      .toArray();

    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Error retrieving flagged reports:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// DELETE /api/admin/reports/:id
router.delete('/reports/:id', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const result = await db.collection('lessonsReports').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    
    res.status(200).json({ success: true, message: 'Report dismissed successfully.' });
  } catch (error) {
    console.error('Error dismissing report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// DELETE /api/admin/lessons/:id
router.delete('/lessons/:id', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const targetObjectId = new ObjectId(id);

    // 1. Wipe the lesson document out entirely from core collection
    const deleteLessonResult = await db.collection('lessons').deleteOne({ _id: targetObjectId });

    if (deleteLessonResult.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Target lesson could not be found.' });
    }

    // 2. Clear out any lingering open report tickets attached to that lesson reference ID
    await db.collection('lessonsReports').deleteMany({ lessonId: targetObjectId });

    res.status(200).json({ success: true, message: 'Lesson wiped and clean up tracking scripts finished.' });
  } catch (error) {
    console.error('Content elimination route failure:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/admin/lessons
router.get('/lessons', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const lessons = await db.collection('lessons')
      .aggregate([
        {
          $lookup: {
            from: 'user',
            localField: 'creatorId',
            foreignField: '_id',
            as: 'creator'
          }
        },
        { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    res.status(200).json({ success: true, data: lessons });
  } catch (error) {
    console.error('Error retrieving all lessons:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/admin/users
router.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { search = '' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await db.collection('user')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { banned } = req.body; // Expects true or false

    const result = await db.collection('user').updateOne(
      { _id: new ObjectId(id) },
      { $set: { banned: Boolean(banned) } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({ 
      success: true, 
      message: banned ? 'User has been banned.' : 'User ban lifted.' 
    });
  } catch (error) {
    console.error('Error toggling user ban state:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/admin/appeals
router.get('/appeals', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const appeals = await db.collection('appeals')
      .aggregate([
        {
          $lookup: {
            from: 'user',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    res.status(200).json({ success: true, data: appeals });
  } catch (error) {
    console.error('Error fetching appeals:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/admin/appeals/:id
router.patch('/appeals/:id', verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body; // Expects 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const appeal = await db.collection('appeals').findOne({ _id: new ObjectId(id) });
    if (!appeal) {
      return res.status(404).json({ success: false, message: 'Appeal not found' });
    }

    // If approved, unban the user
    if (status === 'approved') {
      await db.collection('user').updateOne(
        { _id: appeal.userId },
        { $set: { banned: false, isBanned: false } }
      );
    }

    const result = await db.collection('appeals').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, resolvedAt: new Date() } }
    );

    res.status(200).json({ 
      success: true, 
      message: `Appeal has been ${status}.` 
    });
  } catch (error) {
    console.error('Error resolving appeal:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
