const User = require("../models/User");
const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");

const getParentId = (req) => (req.user?.id ? req.user.id : req.user?._id ? req.user._id : null);

const getSelectedProviderId = async (req) => {
    const parentId = getParentId(req);
    if (!parentId) return null;

    const parent = await User.findById(parentId).select("selectedProviderId").lean();
    return parent?.selectedProviderId || null;
};

exports.listChildrenForSelectedProvider = async (req, res) => {
    try {
        const parentId = getParentId(req);
        if (!parentId) return res.status(401).json({ message: "Unauthorized" });

        const providerId = await getSelectedProviderId(req);
        if (!providerId) {
            // fallback: if no selection is stored, return all children (current behavior)
            const children = await Child.find({ parentId, isActive: true })
                .sort({ createdAt: -1 })
                .lean();
            return res.json({ data: children, count: children.length, selectedProviderId: null });
        }

        // child belongs to the parent, AND is assigned to selected provider
        const children = await Child.find({
            parentId,
            assignedProviderId: providerId,
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .lean();

        res.json({ data: children, count: children.length, selectedProviderId: providerId });
    } catch (error) {
        console.error("listChildrenForSelectedProvider error:", error);
        res.status(500).json({ message: "Error listing children" });
    }
};

exports.getVaccinationsByChildForSelectedProvider = async (req, res) => {
    try {
        const parentId = getParentId(req);
        if (!parentId) return res.status(401).json({ message: "Unauthorized" });

        const { childId } = req.params;
        const providerId = await getSelectedProviderId(req);

        // Ensure child belongs to parent; if provider is selected, also ensure it matches.
        const childQuery = {
            _id: childId,
            parentId,
            isActive: true,
        };
        if (providerId) childQuery.assignedProviderId = providerId;

        const child = await Child.findOne(childQuery).lean();
        if (!child) return res.status(404).json({ message: "Child not found" });

        const vaccinations = await Vaccination.find({
            childId,
            // if provider is selected, constrain by the provider that administered/assigned if your schema supports it.
            // current Vaccination model uses administeredBy; keep broad for now.
        })
            .sort({ dueDate: 1 })
            .populate("administeredBy", "name")
            .lean();

        res.json({ data: vaccinations, count: vaccinations.length, selectedProviderId: providerId || null });
    } catch (error) {
        console.error("getVaccinationsByChildForSelectedProvider error:", error);
        res.status(500).json({ message: "Error fetching vaccinations" });
    }
};

