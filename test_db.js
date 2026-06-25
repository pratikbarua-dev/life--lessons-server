const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons'); // wait, let me check config/db.js to see db name
  const users = await db.collection('user').find().limit(1).toArray();
  console.log("User:", users[0]);
  console.log("User _id type:", typeof users[0]._id, users[0]._id instanceof require('mongodb').ObjectId ? 'ObjectId' : 'not objectId');
  const lessons = await db.collection('lessons').find({title: "Test Lesson (Edited)"}).limit(1).toArray();
  console.log("Lesson creatorId:", lessons[0].creatorId);
  console.log("Lesson creatorId type:", typeof lessons[0].creatorId, lessons[0].creatorId instanceof require('mongodb').ObjectId ? 'ObjectId' : 'not objectId');
  await client.close();
}
test().catch(console.error);
