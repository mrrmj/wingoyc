// api-server.js - Local API proxy with database
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3001;
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";
const DB_FILE = path.join(__dirname, 'database.json');

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.json());

// Initialize database
async function initDatabase() {
    try {
        await fs.access(DB_FILE);
        console.log('Database file exists');
    } catch {
        // Create initial database
        const initialData = {
            records: [],
            lastFetchTime: null,
            lastIssueNumber: null
        };
        await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2));
        console.log('Created new database file');
    }
}

// Read database
async function readDatabase() {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
}

// Write to database
async function writeDatabase(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// Fetch from external API
async function fetchFromAPI() {
    try {
        const response = await axios.get(API_URL, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.error('API fetch error:', error.message);
        return null;
    }
}

// Process and save new records
async function processAndSaveRecords(apiData) {
    const db = await readDatabase();
    const existingIssues = new Set(db.records.map(r => r.issueNumber));
    
    if (apiData && apiData.data && apiData.data.list) {
        const newRecords = apiData.data.list.filter(record => 
            !existingIssues.has(record.issueNumber)
        );
        
        if (newRecords.length > 0) {
            // Add timestamp and sort by issue number
            const timestampedRecords = newRecords.map(record => ({
                ...record,
                fetchedAt: new Date().toISOString(),
                periodNumber: parseInt(record.issueNumber.slice(-5)) || 0
            }));
            
            // Add to database and sort by issue number (descending)
            db.records = [...timestampedRecords, ...db.records]
                .sort((a, b) => b.periodNumber - a.periodNumber)
                .slice(0, 1000); // Keep only last 1000 records
            
            db.lastFetchTime = new Date().toISOString();
            db.lastIssueNumber = db.records[0]?.issueNumber;
            
            await writeDatabase(db);
            console.log(`Added ${newRecords.length} new records. Total: ${db.records.length}`);
            return newRecords;
        }
    }
    
    return [];
}

// API Endpoints
app.get('/api/history', async (req, res) => {
    try {
        const db = await readDatabase();
        const limit = parseInt(req.query.limit) || 50;
        
        res.json({
            success: true,
            data: db.records.slice(0, limit),
            total: db.records.length,
            lastFetch: db.lastFetchTime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/latest', async (req, res) => {
    try {
        // Fetch from external API
        const apiData = await fetchFromAPI();
        
        if (!apiData) {
            const db = await readDatabase();
            return res.json({
                success: true,
                fromCache: true,
                data: db.records.slice(0, 10),
                total: db.records.length
            });
        }
        
        // Process and save new records
        const newRecords = await processAndSaveRecords(apiData);
        
        const db = await readDatabase();
        res.json({
            success: true,
            fromCache: false,
            newRecords: newRecords.length,
            data: db.records.slice(0, 10),
            total: db.records.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const db = await readDatabase();
        res.json({
            success: true,
            totalRecords: db.records.length,
            lastFetchTime: db.lastFetchTime,
            lastIssueNumber: db.lastIssueNumber,
            latestRecords: db.records.slice(0, 5)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-fetch every minute
setInterval(async () => {
    try {
        console.log('Auto-fetching new records...');
        const apiData = await fetchFromAPI();
        if (apiData) {
            await processAndSaveRecords(apiData);
        }
    } catch (error) {
        console.error('Auto-fetch error:', error.message);
    }
}, 60000); // Every 60 seconds

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`✅ Local API server running on http://localhost:${PORT}`);
        console.log(`📊 Endpoints:`);
        console.log(`   http://localhost:${PORT}/api/history - Get all records`);
        console.log(`   http://localhost:${PORT}/api/latest - Get latest + fetch new`);
        console.log(`   http://localhost:${PORT}/api/stats - Get statistics`);
        console.log(`\n⏰ Auto-fetching every 60 seconds...`);
    });
}

startServer();
