/**
 * One-time backfill script:
 * - Finds provider user named "Jane Doe" (approved + active)
 * - Updates all children where assignedProviderId is null/missing/empty
 *   to point to Jane Doe's _id.
 *
 * Usage:
 *   node Backend/src/scripts/backfillAssignedProviderJaneDoe.js
 */
const mongoose = require("mongoose");
const Child = require("../models/Child");
const User = require("../models/User");
const config = require("../config/db");

async function main() {
    // config.db expected shape is not guaranteed; reuse existing db config helper if present.
    // Backend uses ../config/db.js, so we require it to set connection string / connection.
    // If config exports a ready connection, mongoose.connect below may need adjustment.
    const mongoUri = config?.mongoUri || config?.uri || process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("Missing Mongo URI. Set MONGO_URI in environment or update Backend/src/config/db.js usage.");
        process.exit(1);
    }

    await mongoose.connect(mongoUri);

    const janeDoe = await User.findOne({
        role: "provider",
        name: "Jane Doe",
        isApproved: true,
        isActive: true,
    }).select("_id");

    if (!janeDoe) {
        console.error('Provider user "Jane Doe" not found (role=provider, isApproved=true, isActive=true).');
        process.exit(1);
    }

    const janeDoeId = janeDoe._id;

    const result = await Child.updateMany(
        {
            $or: [
                { assignedProviderId: { $exists: false } },
                { assignedProviderId: null },
                { assignedProviderId: "" },
            ],
        },
        {
            $set: { assignedProviderId: janeDoeId },
        }
    );

    console.log("Backfill completed:");
    console.log(`Jane Doe provider id: ${janeDoeId.toString()}`);
    console.log(`Matched: ${result.matchedCount ?? "?"} Updated: ${result.modifiedCount ?? "?"}`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(async (err) => {
    console.error("Backfill failed:", err);
    try {
        await mongoose.disconnect();
    } catch { }
    process.exit(1);
});
