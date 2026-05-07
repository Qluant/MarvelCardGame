const express = require('express');
const cors = require('cors');
require('dotenv').config();

const cardsRouter = require('./routes/cards');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/cards', cardsRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
