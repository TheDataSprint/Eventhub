const mongoose = require("mongoose");

const attendeeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now }
});

const CATEGORIES = ["Conference", "Workshop", "Concert", "Sports", "Networking", "Festival", "Webinar", "Other"];

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        category: {
            type: String,
            enum: CATEGORIES,
            default: "Other"
        },
        date: {
            type: Date,
            required: true
        },
        time: {
            type: String,
            default: "10:00"
        },
        venue: {
            type: String,
            required: true,
            trim: true
        },
        capacity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            default: 0,
            min: 0
        },
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        organizerName: {
            type: String,
            default: ""
        },
        attendees: [attendeeSchema]
    },
    { timestamps: true }
);

eventSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model("Event", eventSchema);
