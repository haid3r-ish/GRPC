const bcrypt = require("bcryptjs");

module.exports = (mongoose) => {
  const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    sessionToken: { type: String, select: false },
    
    // Available subscription tokens
    proTokens: { type: Number, default: 0 },
    // Available free tokens
    freeTokens: { type: Number, default: 5 },
    // daily reset timestamp for subscription tokens 
    lastDailyReset: { type: Date, default: () => new Date().toDateString() },
    
    // subscription: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Subscription",
    // },
    provider: { type: String, enum: ["google","facebook","github"]}, 
    providerId: { type: String, sparse: true, unique: true }, 
    profilePicture: { type: String },
    isBlocked: { type: Boolean, default: false },
    // Password reset fields
    resetToken: { type: String },
    // Expiry time for reset token
    resetTokenExpiry: { type: Date }
  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  });

  // Total tokens available (virtual field)
  userSchema.virtual('totalTokens').get(function() {
    return (this.proTokens || 0) + (this.freeTokens || 0);
  });

  userSchema.methods.correctPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  };

  return userSchema;
}