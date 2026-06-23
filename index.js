require('dotenv').config();
const { parse } = require('dotenv');
const express = require('express');
const {MongoClient, ObjectId} = require('mongodb');

const app = express();
app.use(express.json());
const port = 3100;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db('life-lessons');
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/users', async (req, res) => {
  try {
    const lessons = await db.collection('user').find().toArray();
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//NewsLetter Subscribers
app.post('/api/newsletter/subscribe', async (req, res) => {
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
    const db = await connectToDatabase();
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

app.get('/api/lessons', async (req, res) => {
  try {
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
      { $limit: limitNumber }
    );

    // 4. Fetch Results from the Aggregate Pipeline Execution
    const lessons = await lessonCollection.aggregate(pipeline).toArray();

    // 5. Total Matching Metadata Calculations for Front-End Pagination UI State Control
    const totalLessons = await lessonCollection.countDocuments(query);
    const totalPages = Math.ceil(totalLessons / limitNumber);

    // 6. Finalized JSON Output Structure matching your requirements
    res.json({
      lessons,
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
app.post('/api/lessons', async (req, res) => {
  try {
    const { title, description, category, emotionalTone, visibility, accessLevel, creatorId } = req.body;

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
//My Lessons Route
app.get('/api/users/:userId/lessons', async (req, res) => {
  try {
    const { userId } = req.params;
    
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
app.get('/api/users/:userId/drafts', async (req, res) => {
  try {
    const { userId } = req.params;

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
app.get('/api/users/:userId/favorites', async (req, res) => {
  try {
    const { userId } = req.params;

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
// POST /api/favorites/toggle
app.post('/api/favorites/toggle', async (req, res) => {
  try {
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
// PATCH /api/lessons/:id/like
app.patch('/api/lessons/:id/like', async (req, res) => {
  try {
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
// POST /api/reports
app.post('/api/reports', async (req, res) => {
  try {
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
// POST /api/lessons/:id/comments
app.post('/api/lessons/:id/comments', async (req, res) => {
  try {
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
app.get('/api/lessons/:id/comments', async (req, res) => {
  try {
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

// GET /api/admin/stats
app.get('/api/admin/stats', async (req, res) => {
  try {
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
app.patch('/api/admin/users/:id/role', async (req, res) => {
  try {
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
app.patch('/api/admin/lessons/:id/feature', async (req, res) => {
  try {
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
app.get('/api/admin/reports', async (req, res) => {
  try {
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
// DELETE /api/admin/lessons/:id
app.delete('/api/admin/lessons/:id', async (req, res) => {
  try {
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
// PATCH /api/users/:id/profile
app.patch('/api/users/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
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
// PATCH /api/lessons/:id
app.patch('/api/lessons/:id', async (req, res) => {
  try {
    const { id } = req.params; // Lesson ID
    const { requesterId, title, description, category, emotionalTone, visibility, accessLevel } = req.body;

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
    const requester = await db.collection('users').findOne({ _id: new ObjectId(requesterId) });
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



connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
});