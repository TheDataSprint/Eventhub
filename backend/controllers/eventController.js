const mongoose = require("mongoose");
const Event = require("../models/Event");
const User = require("../models/User");

const startOfToday = () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Shape an event for the client. Attendee details are only shown to the organizer.
const serializeEvent = (event, userId) => {
    const obj = event.toObject ? event.toObject() : event;
    const uid = String(userId);
    const isOrganizer = String(obj.organizer) === uid;
    const attendeeCount = obj.attendees.length;

    const result = {
        _id: obj._id,
        title: obj.title,
        description: obj.description,
        category: obj.category,
        date: obj.date,
        time: obj.time,
        venue: obj.venue,
        capacity: obj.capacity,
        price: obj.price,
        organizer: obj.organizer,
        organizerName: obj.organizerName,
        attendeeCount,
        spotsLeft: Math.max(obj.capacity - attendeeCount, 0),
        isFull: attendeeCount >= obj.capacity,
        isPast: new Date(obj.date) < startOfToday(),
        isOrganizer,
        isRegistered: obj.attendees.some((a) => String(a.user) === uid)
    };

    if (isOrganizer) {
        result.attendees = obj.attendees.map((a) => ({
            _id: a._id,
            name: a.name,
            email: a.email,
            registeredAt: a.registeredAt
        }));
    }

    return result;
};

const parseEventBody = (body) => {
    const errors = [];
    const { title, description, category, date, time, venue, capacity, price } = body;

    if (!title || !String(title).trim()) errors.push("Title is required.");
    if (!venue || !String(venue).trim()) errors.push("Venue is required.");

    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime())) errors.push("A valid date is required.");

    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
        errors.push("Capacity must be a whole number of at least 1.");
    }

    const parsedPrice = price === undefined || price === "" ? 0 : Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) errors.push("Price must be 0 or more.");

    if (category && !Event.CATEGORIES.includes(category)) errors.push("Invalid category.");

    return {
        errors,
        data: {
            title: String(title || "").trim(),
            description: String(description || "").trim(),
            category: category || "Other",
            date: parsedDate,
            time: time || "10:00",
            venue: String(venue || "").trim(),
            capacity: parsedCapacity,
            price: parsedPrice
        }
    };
};

const checkId = (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: "Invalid event id." });
        return false;
    }
    return true;
};

// GET /api/events?search=&category=&scope=upcoming|past|all
exports.listEvents = async (req, res) => {
    try {
        const { search, category, scope = "upcoming" } = req.query;
        const filter = {};

        if (search && search.trim()) {
            const rx = new RegExp(escapeRegex(search.trim()), "i");
            filter.$or = [{ title: rx }, { venue: rx }, { description: rx }];
        }
        if (category && category !== "All") {
            filter.category = category;
        }
        if (scope === "upcoming") {
            filter.date = { $gte: startOfToday() };
        } else if (scope === "past") {
            filter.date = { $lt: startOfToday() };
        }

        const events = await Event.find(filter).sort({ date: scope === "past" ? -1 : 1, time: 1 });
        res.json(events.map((e) => serializeEvent(e, req.userId)));
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/events/categories
exports.getCategories = (req, res) => {
    res.json(Event.CATEGORIES);
};

// GET /api/events/my/created
exports.myCreated = async (req, res) => {
    try {
        const events = await Event.find({ organizer: req.userId }).sort({ date: 1, time: 1 });
        res.json(events.map((e) => serializeEvent(e, req.userId)));
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/events/my/registrations
exports.myRegistrations = async (req, res) => {
    try {
        const events = await Event.find({ "attendees.user": req.userId }).sort({ date: 1, time: 1 });
        res.json(events.map((e) => serializeEvent(e, req.userId)));
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/events/stats
exports.getStats = async (req, res) => {
    try {
        const today = startOfToday();

        const [upcomingTotal, created, registered] = await Promise.all([
            Event.countDocuments({ date: { $gte: today } }),
            Event.find({ organizer: req.userId }),
            Event.find({ "attendees.user": req.userId })
        ]);

        const totalAttendees = created.reduce((sum, e) => sum + e.attendees.length, 0);
        const totalCapacity = created.reduce((sum, e) => sum + e.capacity, 0);
        const upcomingRegistrations = registered
            .filter((e) => e.date >= today)
            .sort((a, b) => a.date - b.date);

        const categoryCounts = {};
        created.forEach((e) => {
            categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
        });

        const topEvents = created
            .map((e) => ({
                _id: e._id,
                title: e.title,
                attendeeCount: e.attendees.length,
                capacity: e.capacity
            }))
            .sort((a, b) => b.attendeeCount - a.attendeeCount)
            .slice(0, 5);

        const next = upcomingRegistrations[0];

        res.json({
            upcomingTotal,
            eventsCreated: created.length,
            registrations: registered.length,
            totalAttendees,
            fillRate: totalCapacity ? Math.round((totalAttendees / totalCapacity) * 100) : 0,
            categoryCounts,
            topEvents,
            nextEvent: next
                ? { _id: next._id, title: next.title, date: next.date, time: next.time, venue: next.venue }
                : null
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// GET /api/events/:id
exports.getEvent = async (req, res) => {
    try {
        if (!checkId(req, res)) return;
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found." });
        res.json(serializeEvent(event, req.userId));
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// POST /api/events
exports.createEvent = async (req, res) => {
    try {
        const { errors, data } = parseEventBody(req.body);
        if (errors.length) return res.status(400).json({ message: errors.join(" ") });

        if (data.date.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
            return res.status(400).json({ message: "Event date cannot be in the past." });
        }

        const user = await User.findById(req.userId).select("name");
        if (!user) return res.status(404).json({ message: "User not found." });

        const event = await Event.create({
            ...data,
            organizer: req.userId,
            organizerName: user.name
        });

        res.status(201).json({ message: "Event created", event: serializeEvent(event, req.userId) });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// PUT /api/events/:id (organizer only)
exports.updateEvent = async (req, res) => {
    try {
        if (!checkId(req, res)) return;

        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found." });
        if (String(event.organizer) !== String(req.userId)) {
            return res.status(403).json({ message: "Only the organizer can edit this event." });
        }

        const { errors, data } = parseEventBody(req.body);
        if (errors.length) return res.status(400).json({ message: errors.join(" ") });

        if (data.capacity < event.attendees.length) {
            return res.status(400).json({
                message: `Capacity cannot be lower than the ${event.attendees.length} people already registered.`
            });
        }

        Object.assign(event, data);
        await event.save();

        res.json({ message: "Event updated", event: serializeEvent(event, req.userId) });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// DELETE /api/events/:id (organizer only)
exports.deleteEvent = async (req, res) => {
    try {
        if (!checkId(req, res)) return;

        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found." });
        if (String(event.organizer) !== String(req.userId)) {
            return res.status(403).json({ message: "Only the organizer can delete this event." });
        }

        await event.deleteOne();
        res.json({ message: "Event deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// POST /api/events/:id/register
exports.registerForEvent = async (req, res) => {
    try {
        if (!checkId(req, res)) return;

        const user = await User.findById(req.userId).select("name email");
        if (!user) return res.status(404).json({ message: "User not found." });

        // Atomic update: only succeeds if the event is upcoming, the user isn't registered
        // and there is still room, so two simultaneous requests cannot overbook the event.
        const updated = await Event.findOneAndUpdate(
            {
                _id: req.params.id,
                date: { $gte: startOfToday() },
                "attendees.user": { $ne: user._id },
                $expr: { $lt: [{ $size: "$attendees" }, "$capacity"] }
            },
            { $push: { attendees: { user: user._id, name: user.name, email: user.email } } },
            { new: true }
        );

        if (updated) {
            return res.status(201).json({
                message: "You are registered!",
                event: serializeEvent(updated, req.userId)
            });
        }

        // Work out why it failed to give a useful message
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found." });
        if (event.attendees.some((a) => String(a.user) === String(req.userId))) {
            return res.status(400).json({ message: "You are already registered for this event." });
        }
        if (event.date < startOfToday()) {
            return res.status(400).json({ message: "This event has already taken place." });
        }
        return res.status(400).json({ message: "Sorry, this event is full." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// DELETE /api/events/:id/register
exports.cancelRegistration = async (req, res) => {
    try {
        if (!checkId(req, res)) return;

        const updated = await Event.findOneAndUpdate(
            { _id: req.params.id, "attendees.user": req.userId },
            { $pull: { attendees: { user: req.userId } } },
            { new: true }
        );

        if (!updated) {
            const exists = await Event.exists({ _id: req.params.id });
            if (!exists) return res.status(404).json({ message: "Event not found." });
            return res.status(400).json({ message: "You are not registered for this event." });
        }

        res.json({ message: "Registration cancelled", event: serializeEvent(updated, req.userId) });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
