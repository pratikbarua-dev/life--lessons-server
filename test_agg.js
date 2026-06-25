const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons');
  const pipeline = [
    { $match: { title: "Test Lesson (Edited)" } },
    {
      $lookup: {
        from: 'user',
        localField: 'creatorId',
        foreignField: '_id',
        as: 'authorInfo'
      }
    }
  ];
  const res = await db.collection('lessons').aggregate(pipeline).toArray();
  console.log("Author info length:", res[0].authorInfo.length);
  if (res[0].authorInfo.length > 0) {
    console.log("Author name:", res[0].authorInfo[0].name);
  }
  await client.close();
}
test().catch(console.error);
