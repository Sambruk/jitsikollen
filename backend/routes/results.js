const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { insertResult, getResult, getResultsByOrg, getRecentResults } = require('../db/database');

// Save test result
router.post('/', (req, res) => {
  try {
    const { organization, totalScore, rating, results } = req.body;
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    insertResult.run(id, organization || null, timestamp, totalScore, rating, JSON.stringify(results), userAgent, ip);

    res.json({ id, timestamp });
  } catch (e) {
    console.error('Error saving result:', e);
    res.status(500).json({ error: 'Kunde inte spara resultatet' });
  }
});

// Get result by ID
router.get('/:id', (req, res) => {
  try {
    const result = getResult.get(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Resultat hittades inte' });
    }
    result.results_json = JSON.parse(result.results_json);
    res.json(result);
  } catch (e) {
    console.error('Error fetching result:', e);
    res.status(500).json({ error: 'Kunde inte hämta resultatet' });
  }
});

// Get results by organization
router.get('/org/:name', (req, res) => {
  try {
    const results = getResultsByOrg.all(req.params.name);
    res.json(results);
  } catch (e) {
    console.error('Error fetching org results:', e);
    res.status(500).json({ error: 'Kunde inte hämta resultat' });
  }
});

// Get recent results
router.get('/', (req, res) => {
  try {
    const results = getRecentResults.all();
    res.json(results);
  } catch (e) {
    console.error('Error fetching recent results:', e);
    res.status(500).json({ error: 'Kunde inte hämta resultat' });
  }
});

module.exports = router;
