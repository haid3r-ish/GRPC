const { default: mongoose } = require("mongoose");

module.exports = (mongoose) => {
    const jobSchema = new mongoose.Schema({
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true,
            ref: 'User' // Links to your authenticated user
        },
        images: [{
            filePath: String,
            status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'] },
            extractedText: String,
            errorMessage: String
        }],
        createdAt: { 
            type: Date, 
            default: Date.now,
            expires: 86400 // 👻 THE GHOST KILLER: MongoDB permanently deletes this doc after 24 hours
        }
    });
    return jobSchema;
}
