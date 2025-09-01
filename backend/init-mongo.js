// db.js - MongoDB database configuration
db = db.getSiblingDB('hr_system');

// Create collections
db.createCollection('candidates');
db.createCollection('interviewsessions');

// Create indexes
db.candidates.createIndex({ "personalInfo.email": 1 }, { unique: true });
db.candidates.createIndex({ "status": 1 });
db.candidates.createIndex({ "createdAt": -1 });

db.interviewsessions.createIndex({ "candidateId": 1 });
db.interviewsessions.createIndex({ "status": 1 });
db.interviewsessions.createIndex({ "startTime": -1 });

print('Database initialized successfully');