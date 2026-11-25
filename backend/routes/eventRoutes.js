const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    listEvents,
    getCategories,
    myCreated,
    myRegistrations,
    getStats,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    registerForEvent,
    cancelRegistration
} = require("../controllers/eventController");

router.use(protect);

// Fixed paths must come before "/:id"
router.get("/categories", getCategories);
router.get("/stats", getStats);
router.get("/my/created", myCreated);
router.get("/my/registrations", myRegistrations);

router.get("/", listEvents);
router.post("/", createEvent);

router.get("/:id", getEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

router.post("/:id/register", registerForEvent);
router.delete("/:id/register", cancelRegistration);

module.exports = router;
