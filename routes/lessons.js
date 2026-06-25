const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { verifyJWT, optionalVerifyJWT } = require('../middlewares/verifyJWT');


router.get('/', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    
    // Check viewer privileges for Premium content protection in the feed
    let isPremiumUser = false;
    let isAdmin = false;
    const viewerId = req.user.id || req.user.sub;

    const dbUser = await db.collection('user').findOne({ _id: new ObjectId(viewerId) });
    if (dbUser) {
      isPremiumUser = dbUser.isPremium;
      isAdmin = dbUser.role === 'admin';
    }

    const {
      search = '',
      category = '',
      emotionalTone = '',
      sortBy = 'newest',
      page = 1,
      limit = 6
    } = req.query;

    // 1. Base Query Filters
    const query = { visibility: 'Public' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }
    if (emotionalTone) {
      query.emotionalTone = emotionalTone;
    }

    // 2. Math Calculation for Pagination Offset
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const lessonCollection = db.collection('lessons');

    // 3. Build the Aggregation Pipeline
    let pipeline = [
      { $match: query } // Step A: Apply search parameters and filtering rules first
    ];

    if (sortBy === 'most-saved') {
      pipeline.push(
        {
          $lookup: {
            from: 'favorites',          // Look into your 'favorites' collection
            localField: '_id',          // Take the lesson ID (stored as string or objectId depending on your mapping)
            foreignField: 'lessonId',   // Match it with the lessonId key in favorites
            as: 'savedRecords'          // Store matches inside an array named 'savedRecords'
          }
        },
        {
          $addFields: {
            savedCount: { $size: '$savedRecords' } // Count the exact amount of saves dynamically
          }
        },
        { $sort: { savedCount: -1 } }   // Sort descending (highest bookmarked entries first)
      );
    } else {
      // Default fallback ordering: Newest items first
      pipeline.push({ $sort: { _id: -1 } });
    }

    // Step C: Apply Pagination slices onto the final structured pipeline
    pipeline.push(
      { $skip: skip },
      { $limit: limitNumber },
      // Step D: Lookup author details after pagination for maximum performance
      {
        $lookup: {
          from: 'user',
          let: { creatorIdString: "$creatorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$creatorIdString" }]
                }
              }
            }
          ],
          as: 'authorInfo'
        }
      },
      {
        $addFields: {
          authorName: { $arrayElemAt: ['$authorInfo.name', 0] },
          authorImage: { $arrayElemAt: ['$authorInfo.image', 0] },
          authorPhotoURL: { $arrayElemAt: ['$authorInfo.photoURL', 0] }, // Fetching both possible image fields
          description: {
            $cond: {
              if: {
                $and: [
                  { $eq: ["$accessLevel", "Premium"] },
                  { $eq: [isPremiumUser, false] },
                  { $eq: [isAdmin, false] },
                  { $ne: [{ $toString: "$creatorId" }, viewerId] }
                ]
              },
              then: { 
                $concat: [
                  { $substrCP: ["$description", 0, 100] }, 
                  "... [Premium Content Locked 🔒]"
                ] 
              },
              else: "$description"
            }
          }
        }
      },
      {
        $project: {
          authorInfo: 0 // Exclude the raw array to keep the payload clean
        }
      }
    );

    // 4. Fetch Results from the Aggregate Pipeline Execution
    const lessons = await lessonCollection.aggregate(pipeline).toArray();

    // 5. Total Matching Metadata Calculations for Front-End Pagination UI State Control
    const totalLessons = await lessonCollection.countDocuments(query);
    const totalPages = Math.ceil(totalLessons / limitNumber);

    // 6. Finalized JSON Output Structure matching your requirements
    res.json({
      lessons,
      totalLessons,
      pagination: {
        totalLessons,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber
      }
    });

  } catch (err) {
    console.error('Error fetching lessons:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/lessons/filters
// Must be defined BEFORE /:id to avoid "filters" being treated as an ID
router.get('/filters', async (req, res) => {
  try {
    const db = getDb();
    
    // Only pull categories and tones from Public lessons so we don't leak private draft tags
    const categories = await db.collection('lessons').distinct('category', { visibility: 'Public' });
    const tones = await db.collection('lessons').distinct('emotionalTone', { visibility: 'Public' });
    
    // Filter out any empty strings or nulls that might have snuck into the DB
    const cleanCategories = categories.filter(c => c && c.trim() !== '');
    const cleanTones = tones.filter(t => t && t.trim() !== '');

    res.json({ 
      success: true, 
      categories: cleanCategories, 
      tones: cleanTones 
    });
  } catch (error) {
    console.error('Error fetching filter metadata:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/lessons/most-saved
router.get('/most-saved', async (req, res) => {
  try {
    const db = getDb();
    
    const lessons = await db.collection('lessons').aggregate([
      { $match: { visibility: 'Public' } },
      {
        $lookup: {
          from: 'favorites',
          localField: '_id',
          foreignField: 'lessonId',
          as: 'savedRecords'
        }
      },
      {
        $addFields: {
          savedCount: { $size: '$savedRecords' }
        }
      },
      { $sort: { savedCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'user',
          let: { creatorIdString: "$creatorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$creatorIdString" }]
                }
              }
            }
          ],
          as: 'authorInfo'
        }
      },
      {
        $addFields: {
          authorName: { $arrayElemAt: ['$authorInfo.name', 0] },
          authorImage: { $arrayElemAt: ['$authorInfo.image', 0] },
          authorPhotoURL: { $arrayElemAt: ['$authorInfo.photoURL', 0] }
        }
      },
      {
        $project: {
          authorInfo: 0,
          savedRecords: 0
        }
      }
    ]).toArray();

    res.status(200).json({ success: true, data: lessons });
  } catch (error) {
    console.error('Error fetching most saved lessons:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// GET /api/lessons/featured
router.get('/featured', async (req, res) => {
  try {
    const db = getDb();
    
    // Fetch featured lessons that are public
    const lessons = await db.collection('lessons')
      .aggregate([
        { $match: { visibility: 'Public', isFeatured: true } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'user',
            let: { creatorIdString: "$creatorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", { $toObjectId: "$$creatorIdString" }]
                  }
                }
              }
            ],
            as: 'authorInfo'
          }
        },
        {
          $addFields: {
            authorName: { $arrayElemAt: ['$authorInfo.name', 0] },
            authorImage: { $arrayElemAt: ['$authorInfo.image', 0] },
            authorPhotoURL: { $arrayElemAt: ['$authorInfo.photoURL', 0] }
          }
        },
        {
          $project: {
            authorInfo: 0
          }
        }
      ]).toArray();

    res.status(200).json({ success: true, data: lessons });
  } catch (error) {
    console.error('Error fetching featured lessons:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/lessons/:id
router.get('/:id', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const lesson = await db.collection('lessons').findOne({ _id: new ObjectId(id) });
    
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // Attach author info (same lookup strategy as the main feed)
    const author = await db.collection('user').findOne({ 
      _id: typeof lesson.creatorId === 'string' ? new ObjectId(lesson.creatorId) : lesson.creatorId 
    });

    if (author) {
      lesson.authorName = author.name;
      lesson.authorImage = author.image;
      lesson.authorPhotoURL = author.photoURL;
    }

    // Protection Logic
    if (lesson.accessLevel === 'Premium') {
      const user = req.user;
      
      // If no token or user is attached, reject
      if (!user) {
        return res.status(403).json({ 
          success: false, 
          isPremiumLocked: true, 
          message: 'Upgrade to Premium to read this lesson.' 
        });
      }

      // Check if they have the rights (Premium, Admin, or Creator)
      // Since `isPremium` isn't in the JWT payload, we must fetch the user from DB to check it securely
      const dbUser = await db.collection('user').findOne({ _id: new ObjectId(user.id || user.sub) });
      const isCreator = lesson.creatorId.toString() === (user.id || user.sub);
      const isAdmin = dbUser && dbUser.role === 'admin';
      const isPremiumUser = dbUser && dbUser.isPremium;

      if (!isCreator && !isAdmin && !isPremiumUser) {
        return res.status(403).json({ 
          success: false, 
          isPremiumLocked: true, 
          message: 'Upgrade to Premium to read this lesson.' 
        });
      }
    }

    // If Free, or if Premium check passed, return the full lesson!
    res.json({ success: true, data: lesson });

  } catch (error) {
    console.error('Error fetching single lesson:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

router.post('/', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { title, description, category, emotionalTone, visibility, accessLevel, creatorId, imageUrl } = req.body;

    // 1. Core structural field validation
    if (!title || !description || !category || !emotionalTone) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // 2. Fetch the creator's profile details to check account tier status
    const usersCollection = db.collection('user');
    const currentUser = await usersCollection.findOne({ _id: new ObjectId(creatorId) });

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // 3. Strict Premium Tier Enforcement Guardrail
    let finalizedAccessLevel = 'Free';
    if (currentUser.isPremium) {
      // Premium users can explicitly choose 'Free' or 'Premium'
      finalizedAccessLevel = accessLevel === 'Premium' ? 'Premium' : 'Free';
    } else if (accessLevel === 'Premium') {
      // Free users trying to force a premium entry get blocked
      return res.status(403).json({
        success: false,
        message: 'Upgrade to Premium to create paid lessons.'
      });
    }

    // 4. Construct complete matching document structure 
    const newLesson = {
      title,
      description,
      category,
      emotionalTone,
      visibility: visibility === 'Private' ? 'Private' : 'Public', // Public default, Private = Draft
      accessLevel: finalizedAccessLevel,
      imageUrl: imageUrl || "",
      thumbnailUrl: "",
      likes: [],
      likesCount: 0,
      isFeatured: false,
      isReviewed: false,
      creatorId: new ObjectId(creatorId),
      createdAt: new Date()
    };

    const result = await db.collection('lessons').insertOne(newLesson);
    res.status(201).json({ success: true, message: 'Life lesson saved successfully! 🎉', lessonId: result.insertedId });

  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/lessons/:id/like
router.patch('/:id/like', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { userId } = req.body; // Sent from frontend logged-in user state

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to like a lesson.' });
    }

    const lessonsCollection = db.collection('lessons');

    // 1. Find the lesson first to verify if the user already liked it
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.' });
    }

    // Check if the user's ID exists inside the likes array
    const hasLiked = lesson.likes && lesson.likes.includes(userId);

    let updateQuery;
    if (hasLiked) {
      // 2. If already liked -> Unlike: Remove userId from array and decrement count by 1
      updateQuery = {
        $pull: { likes: userId },
        $inc: { likesCount: -1 }
      };
    } else {
      // 3. If not liked yet -> Like: Add userId to array and increment count by 1
      updateQuery = {
        $push: { likes: userId },
        $inc: { likesCount: 1 }
      };
    }

    // Execute atomic update operation
    await lessonsCollection.updateOne({ _id: new ObjectId(id) }, updateQuery);

    res.status(200).json({
      success: true,
      isLiked: !hasLiked, // Tells frontend to instantly switch heart UI state
      message: hasLiked ? 'Unliked lesson.' : 'Liked lesson! ❤️'
    });

  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/lessons/:id/comments
router.post('/:id/comments', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params; // Lesson ID
    const { userId, text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty.' });
    }

    const newComment = {
      lessonId: new ObjectId(id),
      userId, // Stored as a structural string/ID reference map
      text: text.trim(),
      createdAt: new Date()
    };

    const result = await db.collection('comments').insertOne(newComment);

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully! 💬',
      comment: { _id: result.insertedId, ...newComment }
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/lessons/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const comments = await db.collection('comments')
      .find({ lessonId: new ObjectId(id) })
      .sort({ createdAt: -1 }) // Newest thoughts run first down the column layout
      .toArray();

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });

  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
// DELETE /api/lessons/comments/:id
router.delete('/comments/:id', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params; // The ID of the comment to delete
    const { requesterId } = req.body; // The ID of the logged-in user making this action

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Requester identity is missing.'
      });
    }

    const commentsCollection = db.collection('comments');
    const commentObjectId = new ObjectId(id);

    // 1. Fetch the targeted comment to verify who wrote it
    const comment = await commentsCollection.findOne({ _id: commentObjectId });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.'
      });
    }

    // 2. Fetch the requester's profile details to verify if they are an Admin
    const usersCollection = db.collection('user');
    const requester = await usersCollection.findOne({ _id: new ObjectId(requesterId) });
    const isAdmin = requester && requester.role === 'admin';

    // 3. Security Guardrail: Requester must be the comment author OR an admin
    // Note: comment.userId could be saved as a string or an ObjectId based on your implementation
    if (comment.userId.toString() !== requesterId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to delete this comment.'
      });
    }

    // 4. Execution: Permanently delete the comment document row
    const result = await commentsCollection.deleteOne({ _id: commentObjectId });

    if (result.deletedCount === 0) {
      throw new Error('Database deletion failed.');
    }

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully! 🗑️'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/lessons/:id
router.patch('/:id', verifyJWT, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params; // Lesson ID
    const { requesterId, title, description, category, emotionalTone, visibility, accessLevel, imageUrl } = req.body;

    if (!requesterId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Requester identity missing.' });
    }

    const lessonsCollection = db.collection('lessons');
    const targetObjectId = new ObjectId(id);

    // 1. Fetch the existing lesson to verify ownership
    const lesson = await lessonsCollection.findOne({ _id: targetObjectId });
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.' });
    }

    // 2. Fetch requester role to check if they are an admin
    const requester = await db.collection('user').findOne({ _id: new ObjectId(requesterId) });
    const isAdmin = requester && requester.role === 'admin';

    // 3. Authorization Guardrail: Must be owner OR admin
    if (lesson.creatorId.toString() !== requesterId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to edit this lesson.'
      });
    }

    // 4. Handle Free vs Premium changes for the owner
    let finalAccessLevel = lesson.accessLevel;
    if (accessLevel) {
      if (isAdmin || (requester && requester.isPremium)) {
        finalAccessLevel = accessLevel;
      } else if (accessLevel === 'Premium') {
        return res.status(403).json({
          success: false,
          message: 'Upgrade to Premium to change access level to Premium.'
        });
      }
    }

    // 5. Build dynamic update object safely (Filtering out Name and Email changes)
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (emotionalTone) updateData.emotionalTone = emotionalTone;
    if (visibility) updateData.visibility = visibility; // Public ↔ Private (Draft)
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    updateData.accessLevel = finalAccessLevel;
    updateData.lastUpdated = new Date();

    await lessonsCollection.updateOne({ _id: targetObjectId }, { $set: updateData });

    res.status(200).json({
      success: true,
      message: 'Lesson updated successfully! 📝'
    });

  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
