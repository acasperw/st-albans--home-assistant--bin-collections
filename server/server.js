require('dotenv').config();
const express = require('express')
const app = express()
const axios = require('axios');

// Configuration
const PORT = process.env.PORT || 3000;
const UPRN = process.env.UPRN;

// Cache configuration
const cache = {
  data: null,
  timestamp: null,
  TTL: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

app.use(express.json());

// Enable CORS for API routes during development
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper function to check if cache is valid
function isCacheValid() {
  if (!cache.data || !cache.timestamp) {
    return false;
  }
  const now = Date.now();
  return (now - cache.timestamp) < cache.TTL;
}

// Helper function to fetch fresh data from API
async function fetchFreshData(uprn) {
  console.log(`Fetching fresh bin collection data from API for UPRN: ${uprn}`);
  
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
  
  // Update cache
  cache.data = response.data;
  cache.timestamp = Date.now();
  
  console.log('Successfully fetched and cached bin collection data');
  return response.data;
}

app.get('/api/bin-collection', async (req, res) => {
  try {
    const uprn = UPRN;
    
    // Check if we have valid cached data
    if (isCacheValid()) {
      console.log(`Serving cached bin collection data for UPRN: ${uprn}`);
      res.json(cache.data);
      return;
    }
    
    // Fetch fresh data if cache is invalid or empty
    const data = await fetchFreshData(uprn);
    res.json(data);
    
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
  const cacheAge = cache.timestamp ? Math.floor((Date.now() - cache.timestamp) / 1000 / 60) : null;
  
  res.json({ 
    status: 'healthy',
    uprn: UPRN,
    timestamp: new Date().toISOString(),
    cache: {
      hasData: !!cache.data,
      ageInMinutes: cacheAge,
      isValid: isCacheValid()
    }
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