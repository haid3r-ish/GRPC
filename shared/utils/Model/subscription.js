module.exports = (mongoose) => {
  const subscriptionSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: 1
    },
    plan: {
      type: String,
      enum: ["pro", "enterprise"],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    active: {
      type: Boolean,
      default: true,
    }
  }, { timestamps: true });
  return subscriptionSchema;
}