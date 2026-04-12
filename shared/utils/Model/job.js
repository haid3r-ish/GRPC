
module.exports = (mongoose) => {
    const jobSchema = new mongoose.Schema({
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true,
            ref: 'User' // Links to your authenticated user
        },
        data: [{
            fileName: String,
            status: {type: String, enum: ["FAILED", "COMPLETED"]},
            extractedText: String
        }],
        createdAt: { 
            type: Date, 
            default: Date.now,
            expires: 86400 // 👻 THE GHOST KILLER: MongoDB permanently deletes this doc after 24 hours
        },
        fetched: {type: Boolean, default: false}
    });
    return jobSchema;
}
