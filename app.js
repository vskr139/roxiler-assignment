const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3004;

// Connect to the SQLite database
const dbFolderPath = 'C:/Users/V siva kumar reddy/Desktop/database-folder';
const dbFilePath = `${dbFolderPath}/data.db`;
const db = new sqlite3.Database(dbFilePath);

// Create a table to store the data

// Middleware to parse JSON requests
app.use(express.json());

// API to initialize the database (Assuming you already have data in the third-party API)
app.post('/initialize-database', async (req, res) => {
  try {
    // Fetch data from the third-party API
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const data = response.data;
    console.log('Data:', data);

    // Insert the data into the database
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS product_transactions (
          id INTEGER PRIMARY KEY,
          dateOfSale TEXT,
          category TEXT,
          price REAL,
          isSold INTEGER NOT NULL CHECK (isSold IN (0, 1))
        )
      `, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        } else {
          console.log('Table created successfully.');
        }
      });

      const stmt = db.prepare(`
        INSERT INTO product_transactions (dateOfSale, category, price, isSold)
        VALUES (?, ?, ?, ?)
      `);

      if (data && Array.isArray(data)) {
        data.forEach((item) => {
          stmt.run(item.dateOfSale, item.category, item.price, item.Sold, (err) => {
            if (err) {
              console.error('Error inserting row:', err.message);
            } else {
              console.log('Row inserted successfully.');
            }
          });
        });

        stmt.finalize();
        console.log('Statement finalized.');
      } else {
        console.error('Data is empty or not an array.');
      }
    });

    res.json({ message: 'Database initialized with seed data.' });
  } catch (error) {
    console.error('Error initializing database:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// API for Statistics
app.get('/statistics', (req, res) => {
  const { month } = req.query;
  console.log('Month:', month);

  const sql = `
    SELECT SUM(price) as totalSaleAmount, 
           SUM(CASE WHEN isSold = 1 THEN 1 ELSE 0 END) as totalSoldItems,
           SUM(CASE WHEN isSold = 0 THEN 1 ELSE 0 END) as totalNotSoldItems
    FROM product_transactions
    WHERE strftime('%B', dateOfSale) = ?
  `;
  console.log('SQL:', sql);

  db.get(sql, [month], (err, row) => {
    if (err) {
      console.error('Error retrieving statistics:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      console.log('Statistics retrieved successfully.');
      res.json(row);
    }
  });
});



// API for Bar Chart
app.get('/bar-chart', (req, res) => {
  const { month } = req.query;

  const sql = `
    SELECT 
      COUNT(CASE WHEN price >= 0 AND price <= 100 THEN 1 END) as range0_100,
      COUNT(CASE WHEN price >= 101 AND price <= 200 THEN 1 END) as range101_200,
      COUNT(CASE WHEN price >= 201 AND price <= 300 THEN 1 END) as range201_300,
      COUNT(CASE WHEN price >= 301 AND price <= 400 THEN 1 END) as range301_400,
      COUNT(CASE WHEN price >= 401 AND price <= 500 THEN 1 END) as range401_500,
      COUNT(CASE WHEN price >= 501 AND price <= 600 THEN 1 END) as range501_600,
      COUNT(CASE WHEN price >= 601 AND price <= 700 THEN 1 END) as range601_700,
      COUNT(CASE WHEN price >= 701 AND price <= 800 THEN 1 END) as range701_800,
      COUNT(CASE WHEN price >= 801 AND price <= 900 THEN 1 END) as range801_900,
      COUNT(CASE WHEN price >= 901 THEN 1 END) as range901_above
    FROM product_transactions
    WHERE strftime('%B', dateOfSale) = ?
  `;

  db.get(sql, [`${month} 2023`], (err, row) => {
    if (err) {
      console.error('Error retrieving bar chart data:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(row);
    }
  });
});

// API for Pie Chart
app.get('/pie-chart', (req, res) => {
  const { month } = req.query;

  const sql = `
    SELECT category, COUNT(*) as itemCount
    FROM product_transactions
    WHERE strftime('%B', dateOfSale) = ?
    GROUP BY category
  `;

  db.all(sql, [`${month} 2023`], (err, rows) => {
    if (err) {
      console.error('Error retrieving pie chart data:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(rows);
    }
  });
});

// API to Fetch Combined Data
app.get('/combined-data', async (req, res) => {
  const { month } = req.query;

  try {
    const [statistics, barChart, pieChart] = await Promise.all([
      axios.get(`http://localhost:${port}/statistics?month=${month}`),
      axios.get(`http://localhost:${port}/bar-chart?month=${month}`),
      axios.get(`http://localhost:${port}/pie-chart?month=${month}`)
    ]);

    const combinedData = {
      statistics: statistics.data,
      barChart: barChart.data,
      pieChart: pieChart.data
    };

    res.json(combinedData);
  } catch (error) {
    console.error('Error retrieving combined data:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
