const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  site: {
    type: String,
    required: true,
    enum: ["truthit", "solbetx", "predictsol"]
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  eventId: {
    type: String,
    default: null
  },

  types: [{
    type: String,
    enum: [
      "commit_end",
      "reveal_end",
      "general_updates",
      "event_updates",
      "result"
    ]
  }],

  active: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});


SubscriptionSchema.index({ site: 1 });
SubscriptionSchema.index({ site: 1, types: 1 });
SubscriptionSchema.index({ site: 1, eventId: 1 });
SubscriptionSchema.index({ email: 1 });

module.exports = mongoose.model("Subscription", SubscriptionSchema);