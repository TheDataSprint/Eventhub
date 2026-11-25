const User = require("../models/User");

// GET /api/user/profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// PUT /api/user/profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, email, phone, organization, bio } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Name is required." });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ message: "Email is required." });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const taken = await User.findOne({ email: normalizedEmail, _id: { $ne: req.userId } });
        if (taken) {
            return res.status(400).json({ message: "Email is already in use." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            {
                name: name.trim(),
                email: normalizedEmail,
                phone: (phone || "").trim(),
                organization: (organization || "").trim(),
                bio: (bio || "").trim()
            },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
