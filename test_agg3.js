const { MongoClient, ObjectId } = require('mongodb');
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
        let: { cid: "$creatorId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$cid" }] } } }
        ],
        as: 'authorInfo'
      }
    }
  ];
  const res = await db.collection('lessons').aggregate(pipeline).toArray();
  console.log("Author info length (ObjectId):", res[0].authorInfo.length);

  const pipeline2 = [
    { $match: { title: "Premium Strategy: Architecting Long-term Networks" } },
    {
      $lookup: {
        from: 'user',
        let: { cid: "$creatorId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", { $toObjectId: "$$cid" }] } } }
        ],
        as: 'authorInfo'
      }
    }
  ];
  const res2 = await db.collection('lessons').aggregate(pipeline2).toArray();
  console.log("Author info length (String):", res2.length > 0 ? res2[0].authorInfo.length : 'no res');

  await client.close();
}
test().catch(console.error);
