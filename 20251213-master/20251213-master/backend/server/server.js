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

// STOP: Checkout (Stop Timer & Calculate Reward)
app.post('/api/checkout', (req, res) => {
    const { stayId, userAddress } = req.body;

    if (!stayId || !userAddress) {
        return res.status(400).json({ error: 'Missing stayId or userAddress' });
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

            const endTime = Date.now();
            const startTime = row.startTime;
            const durationMs = endTime - startTime;
            const durationSeconds = Math.floor(durationMs / 1000);

            // Reward Logic: 1 second = 0.1 Token
            // use Math.floor to keep it simple, or keep decimals? 
            // User asked: "1 second = 0.1 token"
            // Let's keep 1 decimal place.
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
