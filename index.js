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

app.get('/api/lessons', async(req,res)=>{
  try{
    const {
      search = '',
      category = '',
      emotionalTone = '',
      sortBy = 'newest',
      page = 1,
      limit = 6
    }= req.query;
     const query = {visibility : 'Public'};
     if(search){
      query.$or =[
        {title: {$regex: search, $options: 'i'}},
        {description: {$regex: search, $options: 'i'}}
      ];
     }
     if(category){
      query.category = category;
     }
     if(emotionalTone){
      query.emotionalTone = emotionalTone;
     }
     let sortOptions = {};
     if(sortBy === 'most-saved'){
      sortOptions = {likesCount : -1};
     }else{
      sortOptions = {_id : -1};
     }
     //Pagination - How much to skip
     const pageNumber = parseInt(page);
     const limitNumber = parseInt(limit);
     const skip = (pageNumber-1) * limitNumber;

     const lessonCollection = db.collection('lessons');

     //fetch Filtered Items
     const lessons = await lessonCollection.find(query).sort(sortOptions).skip(skip).limit(limitNumber).toArray();

     //Fetch Total Matching for frontend pagination control
     const totalLessons = await lessonCollection.countDocuments(query);
     const totalPages = Math.ceil(totalLessons / limitNumber);

     res.json({
       lessons,
       pagination: {
         totalLessons,
         totalPages,
         currentPage: pageNumber,
         limit: limitNumber
       }
     });
  }
 
  catch(err){
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
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

connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
});