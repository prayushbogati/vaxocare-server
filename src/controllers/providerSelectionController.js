const User = require("../models/User");
const Child = require("../models/Child");

// In this codebase, provider is a User with role === "provider".
// A parent chooses which provider's schedule/vaccines they want to view.
// We persist selection on the parent user document.

const getParentId = (req) => req.user && req.user.id ? req.user.id : req.user && req.user._id ? req.user._id : null;

exports.listProvidersForParent = async (req, res) => {
    try {
        const parentId = getParentId(req);
        if (!parentId) return res.status(401).json({ message: "Unauthorized" });

        // Return all active, approved providers so parents can choose by username.
        const providers = await User.find({
            role: "provider",
            isApproved: true,
            isActive: true,
        })
            .select("name email phone address approvedAt approvedBy username")
            .sort({ name: 1, email: 1 })
            .lean();

        const normalizedProviders = (Array.isArray(providers) ? providers : []).map((p) => ({
            ...p,
            username: p.username || p.email || p.name || "",
        }));

        res.json({ data: normalizedProviders, count: normalizedProviders.length });
    } catch (error) {
        console.error("listProvidersForParent error:", error);
        res.status(500).json({ message: "Error listing providers" });
    }
};

exports.setSelectedProvider = async (req, res) => {
    try {
        const parentId = getParentId(req);
        if (!parentId) return res.status(401).json({ message: "Unauthorized" });

        const { providerId } = req.body;
        if (!providerId) return res.status(400).json({ message: "providerId is required" });

        const provider = await User.findById(providerId);
        if (!provider || provider.role !== "provider") {
            return res.status(404).json({ message: "Provider not found" });
        }

        // Persist selection on parent user
        // (schema currently doesn't include provider selection fields explicitly,
        // but MongoDB will still store them unless strict mode is enabled.)
        await User.findByIdAndUpdate(parentId, {
            selectedProviderId: providerId,
            selectedProviderAt: new Date(),
        });

        res.json({ message: "Selected provider updated" });
    } catch (error) {
        console.error("setSelectedProvider error:", error);
        res.status(500).json({ message: "Error selecting provider" });
    }
};

exports.getSelectedProvider = async (req, res) => {
    try {
        const parentId = getParentId(req);
        if (!parentId) return res.status(401).json({ message: "Unauthorized" });

        const parent = await User.findById(parentId).select("selectedProviderId").lean();

        // If no selection is stored, default to the only approved provider
        // (or any available provider returned by the listing logic).
        if (!parent?.selectedProviderId) {
            const providers = await User.find({
                role: "provider",
                isApproved: true,
                isActive: true,
            })
                .select("_id")
                .lean();

            if (providers.length === 1) {
                const onlyProviderId = providers[0]._id;
                await User.findByIdAndUpdate(parentId, {
                    selectedProviderId: onlyProviderId,
                    selectedProviderAt: new Date(),
                });
                return res.json({ providerId: String(onlyProviderId) });
            }

            return res.json({ providerId: null });
        }

        res.json({ providerId: parent.selectedProviderId });
    } catch (error) {
        console.error("getSelectedProvider error:", error);
        res.status(500).json({ message: "Error fetching selected provider" });
    }
};




