const express = require("express");
const router = express.Router();

const {
    listProvidersForParent,
    setSelectedProvider,
    getSelectedProvider,
} = require("../controllers/providerSelectionController");

const { protect } = require("../middleware/authMiddleware");

// Parent endpoints require authentication
router.use(protect);

router.get("/providers", listProvidersForParent);
router.post("/selected-provider", setSelectedProvider);
router.get("/selected-provider", getSelectedProvider);

module.exports = router;


