const mongoose = require("mongoose");

const centerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide center name"],
    trim: true,
  },
  location: {
    type: String,
    required: true,
  },
  dailyCapacity: {
    type: Number,
    default: 20,
  },
  availableVaccines: [{
    type: String,
  }],
  operatingHours: {
    type: String,
    default: "9:00 AM - 5:00 PM",
  },
  contactNumber: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model("Center", centerSchema);

