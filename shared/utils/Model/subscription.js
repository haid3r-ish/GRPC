const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  plan: {
    type: String,
    enum: ["basic", "pro", "enterprise"],
    default: "basic",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

subscriptionSchema.pre("save", function (next) {
  if (!this.endDate) {
    //30 days from now
    const duration = 30 * 24 * 60 * 60 * 1000;
    this.endDate = new Date(Date.now() + duration);
  }
  next();
});

module.exports = mongoose.model("Subscription", subscriptionSchema);