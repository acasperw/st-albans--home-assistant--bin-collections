require('dotenv').config();
const express = require('express')
const app = express()
const axios = require('axios');

// Configuration
const PORT = process.env.PORT || 3000;
const UPRN = process.env.UPRN;

app.use(express.json());

// Enable CORS for API routes during development
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/api/bin-collection', async (req, res) => {
  try {
    const uprn = UPRN;
    console.log(`Fetching bin collection data for UPRN: ${uprn}`);
    
    const response = await axios.post(
      'https://gis.stalbans.gov.uk/NoticeBoard9/VeoliaProxy.NoticeBoard.asmx/GetServicesByUprnAndNoticeBoard',
      {
        uprn: parseInt(uprn),
        noticeBoard: 'default'
      },
      {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Successfully fetched bin collection data');
    res.json(response.data);
    
  } catch (error) {
    console.error('Error fetching bin collection data:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch bin collection data',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uprn: UPRN,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});