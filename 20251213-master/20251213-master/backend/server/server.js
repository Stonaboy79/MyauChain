const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Check-in Endpoint
app.use((req, res, next) => {
    // Check for BigInt in JSON and convert to string to avoid serialization errors
    // Not strictly needed for this simple logic but good practice if handling raw Move values later
    next();
});

// START: Check-in (Start Timer)
app.post('/api/checkin', (req, res) => {
    const { userAddress, lat, lng } = req.body;

    if (!userAddress || !lat || !lng) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const startTime = Date.now();

    db.run(
        `INSERT INTO stays (userAddress, lat, lng, startTime, status) VALUES (?, ?, ?, ?, ?)`,
        [userAddress, lat, lng, startTime, 'active'],
        function (err) {
            if (err) {
                console.error("DB Error:", err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({
                success: true,
                stayId: this.lastID,
                message: "Check-in successful",
                startTime: startTime
            });
        }
    );
});

// Helper: Calculate distance between two points in km (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// STOP: Checkout (Stop Timer & Calculate Reward)
app.post('/api/checkout', (req, res) => {
    const { stayId, userAddress, lat, lng } = req.body;

    if (!stayId || !userAddress || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Missing stayId, userAddress, or location data' });
    }

    // Find the active stay
    db.get(
        `SELECT * FROM stays WHERE id = ? AND userAddress = ? AND status = 'active'`,
        [stayId, userAddress],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Active stay not found' });
            }

            // Verify distance
            const startLat = row.lat;
            const startLng = row.lng;
            const distanceKm = getDistanceFromLatLonInKm(startLat, startLng, lat, lng);
            const ALLOWED_RADIUS_KM = 0.05; // 50 meters

            const endTime = Date.now();

            if (distanceKm > ALLOWED_RADIUS_KM) {
                // Moved too far -> Check-in failed / No reward
                db.run(
                    `UPDATE stays SET endTime = ?, status = 'failed', earnedTokens = 0, message = 'Moved too far' WHERE id = ?`,
                    [endTime, stayId],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({
                            success: false,
                            tokensEarned: 0,
                            message: `Checkout failed. Moved too far (${(distanceKm * 1000).toFixed(0)}m). Limit is ${ALLOWED_RADIUS_KM * 1000}m.`
                        });
                    }
                );
                return;
            }

            const startTime = row.startTime;
            const durationMs = endTime - startTime;
            const durationSeconds = Math.floor(durationMs / 1000);

            // Reward Logic: 1 second = 0.1 Token
            const tokensEarned = Math.floor(durationSeconds * 0.1 * 10) / 10;

            db.run(
                `UPDATE stays SET endTime = ?, status = 'completed', earnedTokens = ? WHERE id = ?`,
                [endTime, tokensEarned, stayId],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({
                        success: true,
                        tokensEarned: tokensEarned,
                        durationSeconds: durationSeconds,
                        message: `Checkout successful. Duration: ${durationSeconds}s. Reward: ${tokensEarned} tokens.`
                    });
                }
            );
        }
    );
});

// Get User History
app.get('/api/history/:userAddress', (req, res) => {
    const { userAddress } = req.params;
    db.all(
        `SELECT * FROM stays WHERE userAddress = ? ORDER BY startTime DESC`,
        [userAddress],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
