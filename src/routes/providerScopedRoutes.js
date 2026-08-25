const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    listChildrenForSelectedProvider,
    getVaccinationsByChildForSelectedProvider,
} = require("../controllers/providerScopedController");

router.use(protect);

router.get("/children/selected-provider", listChildrenForSelectedProvider);
router.get("/vaccinations/child/:childId/selected-provider", getVaccinationsByChildForSelectedProvider);

module.exports = router;

