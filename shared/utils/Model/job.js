const mongoose = require('mongoose');

const ocrBatchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    images: [{
        filePath: String,
        status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
        extractedText: { type: String, default: null },
        errorMessage: { type: String, default: null }
    }]
}, { timestamps: true });

module.exports = mongoose.model('OcrBatch', ocrBatchSchema);