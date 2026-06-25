require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const NUM_USERS = 40;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/life-lessons";

// Random Data Generators
const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"];

const categories = ["Relationships", "Career", "Philosophy", "Health", "Growth", "Finance", "Creativity", "Travel"];
const emotionalTones = ["Reflective", "Optimistic", "Melancholy", "Analytical", "Inspiring", "Neutral", "Humorous", "Grateful", "Somber"];

const lessonTitles = [
    "The truth about starting over", "Why failure is a good thing", "Lessons from my first heartbreak",
    "How to manage your time better", "Finding peace in chaos", "The power of saying no",
    "What I learned from traveling alone", "Overcoming imposter syndrome", "The importance of financial literacy",
    "Embracing the unknown", "Why patience is a superpower", "The art of active listening",
    "Healing from past trauma", "How to build lasting habits", "The joy of missing out (JOMO)",
    "Navigating career transitions", "The truth about passive income", "Lessons from a silent retreat"
];

const lessonDescriptions = [
    "When everything falls apart, you finally have the chance to rebuild from scratch. Here is what I learned during my darkest hour and how I emerged stronger than ever. The journey wasn't easy, but it was necessary.",
    "Society tells us to avoid failure at all costs, but what if failure is just data? Every time I failed, I learned exactly what not to do next time. It's the ultimate learning tool if you adjust your perspective.",
    "Time is the only resource we can't get back. I spent years saying yes to things I didn't care about. Once I started ruthlessly prioritizing my schedule, my entirely life changed for the better.",
    "We are so connected digitally, yet many feel completely isolated. Taking the time to disconnect and focus on my immediate surroundings helped me find a sense of groundedness I hadn't felt since childhood.",
    "The most important investment you can make is in yourself. Whether it's learning a new skill, taking care of your health, or protecting your peace, the returns compound massively over time."
];

const userImages = [
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
];

const lessonImages = [
    "https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1472289065668-ce650ce44399?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80"
];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
    console.log("Connecting to MongoDB...");
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('life-lessons');
        console.log("Connected successfully to DB.");

        const usersCollection = db.collection('user');
        const lessonsCollection = db.collection('lessons');
        const favoritesCollection = db.collection('favorites');
        const commentsCollection = db.collection('comments');
        const reportsCollection = db.collection('reports');
        const appealsCollection = db.collection('appeals');

        console.log("Dropping existing collections to start fresh...");
        await usersCollection.deleteMany({});
        await lessonsCollection.deleteMany({});
        await favoritesCollection.deleteMany({});
        await commentsCollection.deleteMany({});
        await reportsCollection.deleteMany({});
        await appealsCollection.deleteMany({});

        // 1. Generate 40 Users
        console.log(`Generating ${NUM_USERS} users...`);
        const users = [];
        for (let i = 0; i < NUM_USERS; i++) {
            const name = `${getRandomItem(firstNames)} ${getRandomItem(lastNames)}`;
            const email = `${name.replace(/\s+/g, '.').toLowerCase()}_${getRandomInt(100, 999)}@example.com`;
            
            // Randomly assign roles and statuses
            const isPremium = Math.random() > 0.7; // ~30% premium
            const role = Math.random() > 0.9 ? 'admin' : 'user'; // ~10% admin
            const isBanned = Math.random() > 0.9; // ~10% banned

            users.push({
                name,
                email,
                emailVerified: true,
                image: getRandomItem(userImages),
                role,
                isPremium,
                isBanned,
                createdAt: new Date(Date.now() - getRandomInt(100000, 10000000000)),
                updatedAt: new Date()
            });
        }
        
        const userInsertResult = await usersCollection.insertMany(users);
        const insertedUserIds = Object.values(userInsertResult.insertedIds);
        console.log(`Inserted ${insertedUserIds.length} users.`);

        // Separate banned users for appeals
        const bannedUserIds = users.filter(u => u.isBanned).map((u, index) => insertedUserIds[index]);

        // 2. Generate Lessons
        console.log("Generating lessons...");
        const lessons = [];
        for (const userId of insertedUserIds) {
            // Find user tier
            const userIndex = insertedUserIds.indexOf(userId);
            const user = users[userIndex];
            
            // Generate 0 to 4 lessons per user
            const numLessons = getRandomInt(0, 4);
            for (let j = 0; j < numLessons; j++) {
                const visibility = Math.random() > 0.2 ? 'Public' : 'Private'; // 80% public
                let accessLevel = 'Free';
                if (user.isPremium && Math.random() > 0.5) {
                    accessLevel = 'Premium';
                }

                lessons.push({
                    title: getRandomItem(lessonTitles) + (Math.random() > 0.5 ? "!" : ""),
                    description: getRandomItem(lessonDescriptions),
                    category: getRandomItem(categories),
                    emotionalTone: getRandomItem(emotionalTones),
                    visibility,
                    accessLevel,
                    imageUrl: getRandomItem(lessonImages),
                    thumbnailUrl: "",
                    likes: [],
                    likesCount: 0,
                    isFeatured: Math.random() > 0.9,
                    isReviewed: true,
                    creatorId: userId,
                    createdAt: new Date(Date.now() - getRandomInt(1000, 5000000000)),
                    lastUpdated: new Date()
                });
            }
        }
        
        const lessonInsertResult = await lessonsCollection.insertMany(lessons);
        const insertedLessonIds = Object.values(lessonInsertResult.insertedIds);
        const publicLessonIds = lessons.filter(l => l.visibility === 'Public').map((l, index) => insertedLessonIds[index]);
        console.log(`Inserted ${insertedLessonIds.length} lessons.`);

        // 3. Generate Engagements (Likes, Favorites, Comments)
        console.log("Simulating engagements (Likes, Saves, Comments)...");
        const favorites = [];
        const comments = [];
        
        // Let's have each user interact with a random subset of public lessons
        for (const userId of insertedUserIds) {
            // Select 3 to 10 random lessons for this user to interact with
            const interactionCount = getRandomInt(3, 10);
            const shuffledLessons = [...publicLessonIds].sort(() => 0.5 - Math.random());
            const targetLessons = shuffledLessons.slice(0, Math.min(interactionCount, shuffledLessons.length));
            
            for (const lessonId of targetLessons) {
                // Determine interactions randomly
                const doLike = Math.random() > 0.3; // 70% chance to like
                const doSave = Math.random() > 0.7; // 30% chance to save
                const doComment = Math.random() > 0.8; // 20% chance to comment

                if (doLike) {
                    await lessonsCollection.updateOne(
                        { _id: lessonId },
                        { 
                            $push: { likes: userId.toString() },
                            $inc: { likesCount: 1 }
                        }
                    );
                }

                if (doSave) {
                    favorites.push({
                        userId: userId.toString(),
                        lessonId: lessonId.toString(),
                        savedAt: new Date(Date.now() - getRandomInt(1000, 1000000000))
                    });
                }

                if (doComment) {
                    comments.push({
                        lessonId: lessonId,
                        userId: userId.toString(),
                        text: getRandomItem([
                            "This is incredibly insightful, thank you for sharing!",
                            "I went through something similar last year. Glad I'm not alone.",
                            "Brilliant perspective.",
                            "I completely disagree, but I appreciate you taking the time to write this.",
                            "This really helped me today.",
                            "Such a beautifully written reflection."
                        ]),
                        createdAt: new Date(Date.now() - getRandomInt(1000, 1000000000))
                    });
                }
            }
        }

        if (favorites.length > 0) await favoritesCollection.insertMany(favorites);
        if (comments.length > 0) await commentsCollection.insertMany(comments);
        console.log(`Inserted ${favorites.length} favorites and ${comments.length} comments.`);

        // 4. Generate Reports
        console.log("Simulating moderation reports...");
        const reports = [];
        const reportReasons = ["Inappropriate Content", "Spam or Misleading", "Harassment or Hate Speech", "Low Quality / Plagiarism"];
        // Pick 3 random lessons to report
        const reportedLessonIds = [...publicLessonIds].sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const lessonId of reportedLessonIds) {
            reports.push({
                lessonId: lessonId,
                reporterUserId: getRandomItem(insertedUserIds).toString(),
                reportedUserEmail: "simulated_report@example.com",
                reason: getRandomItem(reportReasons),
                status: 'pending',
                createdAt: new Date(Date.now() - getRandomInt(1000, 50000000))
            });
        }
        if (reports.length > 0) await reportsCollection.insertMany(reports);
        console.log(`Inserted ${reports.length} reports.`);

        // 5. Generate Appeals
        console.log("Simulating ban appeals...");
        const appeals = [];
        for (const bannedUserId of bannedUserIds) {
            // 50% chance a banned user appeals
            if (Math.random() > 0.5) {
                appeals.push({
                    userId: bannedUserId,
                    reason: "I believe my account was mistakenly suspended. I have never violated the terms of service.",
                    status: 'pending',
                    createdAt: new Date(Date.now() - getRandomInt(1000, 50000000))
                });
            }
        }
        if (appeals.length > 0) await appealsCollection.insertMany(appeals);
        console.log(`Inserted ${appeals.length} appeals.`);

        console.log("✅ Seeding completed successfully!");

    } catch (err) {
        console.error("❌ Error during seeding:", err);
    } finally {
        await client.close();
        console.log("Database connection closed.");
    }
}

seed();
