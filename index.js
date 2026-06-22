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


connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
});