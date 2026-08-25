/**
 * Provider portal smoke test (curl-like via fetch/axios).
 *
 * Usage:
 *   node Backend/src/scripts/providerPortalSmokeTest.js
 *
 * Requires:
 *   - SERVER_URL env var (optional; default http://localhost:3000)
 *   - TOKEN env var (required unless you hardcode below)
 *
 * Example:
 *   set TOKEN=... 
 *   node src/scripts/providerPortalSmokeTest.js
 */
const process = require("process");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";
const TOKEN = process.env.TOKEN || "";

// Node 20 has global fetch
if (!TOKEN) {
    console.error("Missing TOKEN. Set env var: TOKEN=<jwt> .");
    process.exit(1);
}

const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
};

function logResult(title, res) {
    console.log("\n==== " + title + " ====");
    console.log("Status:", res.status);
    return res
        .text()
        .then((t) => {
            try {
                const j = JSON.parse(t);
                console.log("JSON:", JSON.stringify(j, null, 2));
                return j;
            } catch {
                console.log("Body:", t);
                return t;
            }
        })
        .catch((e) => {
            console.error("Failed to read response:", e);
            return null;
        });
}

async function getJson(path) {
    const res = await fetch(SERVER_URL + path, { method: "GET", headers });
    return logResult(`GET ${path}`, res);
}

async function putJson(path, body) {
    const res = await fetch(SERVER_URL + path, {
        method: "PUT",
        headers,
        body: JSON.stringify(body || {}),
    });
    return logResult(`PUT ${path}`, res);
}

async function main() {
    console.log("SERVER_URL:", SERVER_URL);

    // 1) Children
    const childrenResp = await getJson("/api/provider/children");
    const children = Array.isArray(childrenResp) ? childrenResp : (childrenResp?.data || childrenResp?.children || []);

    // Some endpoints return {data:[...]}
    const childrenList =
        Array.isArray(children) ? children : Array.isArray(childrenResp?.data) ? childrenResp.data : [];

    const firstChild = childrenList?.[0];
    const childId = firstChild?._id || firstChild?.id;

    if (!childId) {
        console.log("\nNo child returned by /api/provider/children. Stopping further calls.");
        return;
    }

    // 2) Child vaccinations
    await getJson(`/api/provider/children/${childId}/vaccinations`);

    // 3) Today appointments
    await getJson("/api/provider/appointments/today");

    // 4) Daily / overdue / upcoming
    await getJson("/api/provider/daily-summary");
    await getJson("/api/provider/overdue");
    await getJson("/api/provider/upcoming?days=7");

    // 5) Child risk prediction
    await getJson(`/api/provider/children/${childId}/risk`);

    console.log("\nSmoke test complete. (Approve/reject/reschedule requires an appointmentId; skipping automatically.)");
}

main().catch((e) => {
    console.error("Smoke test failed:", e);
    process.exit(1);
});
