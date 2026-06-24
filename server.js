'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const { processData } = require('./src/processor');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const IDENTITY = {
  user_id: process.env.USER_ID || 'prajyantveersiag_27092005',
  email_id: process.env.EMAIL_ID || 'prajyant2494.be23@chitkara.edu.in',
  college_roll_number: process.env.COLLEGE_ROLL_NUMBER || '2310992494',
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bfhl-hierarchy-api' });
});

app.post('/bfhl', (req, res) => {
  try {
    const body = req.body || {};

    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
      return res.status(400).json({
        is_success: false,
        error: "Request body must contain a 'data' field.",
      });
    }

    if (!Array.isArray(body.data)) {
      return res.status(400).json({
        is_success: false,
        error: "'data' must be an array of strings.",
      });
    }

    const result = processData(body.data);

    return res.status(200).json({
      ...IDENTITY,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({
      is_success: false,
      error: 'Internal server error while processing data.',
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({
      is_success: false,
      error: 'Invalid JSON in request body.',
    });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      is_success: false,
      error: 'Request body too large.',
    });
  }
  return res.status(500).json({
    is_success: false,
    error: 'Internal server error.',
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`bfhl API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
