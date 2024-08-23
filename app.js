const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// Initialize SQLite database
const db = new sqlite3.Database('payments.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the payments database.');
});

// Create the Payment table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS Payment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        service_provider_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        upi_id TEXT
    )
`);

// Generate random transaction ID
function generateTransactionId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let transactionId = '';
    const length = Math.floor(Math.random() * 3) + 10; // Random length between 10 and 12
    for (let i = 0; i < length; i++) {
        transactionId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return transactionId;
}

// Simulate an actual UPI transaction initiation
async function initiateUPIPayment({ amount, upi_id, transaction_id }) {
    // Replace this with actual API request to UPI payment provider (Razorpay, Paytm, etc.)
    // For demonstration, we will simulate a delay and assume the transaction is initiated
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
    console.log(`UPI Payment initiated for Transaction ID: ${transaction_id}`);
    return {
        success: true,
        message: `Payment initiated via UPI ID ${upi_id}. Please complete the transaction in your UPI app.`,
    };
}

// Route to initiate a payment
app.post('/initiate_payment', async (req, res) => {
    const { user_id, service_provider_id, amount, upi_id } = req.body;

    if (!user_id || !service_provider_id || !amount || !upi_id) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    const transaction_id = generateTransactionId();
    const status = 'pending';

    const query = `
        INSERT INTO Payment (transaction_id, user_id, service_provider_id, amount, status, upi_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [transaction_id, user_id, service_provider_id, amount, status, upi_id], async function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to initiate payment' });
        }
        
        // Initiate UPI Payment via UPI API
        try {
            const paymentResponse = await initiateUPIPayment({ amount, upi_id, transaction_id });
            res.status(201).json({ transaction_id, status, message: paymentResponse.message });
        } catch (error) {
            res.status(500).json({ error: 'Failed to initiate UPI payment' });
        }
    });
});

// Route for UPI payment callback (Webhook simulation)
app.post('/upi_callback', (req, res) => {
    const { transaction_id, payment_status } = req.body;

    if (!transaction_id || !payment_status) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    const query = `
        UPDATE Payment SET status = ? WHERE transaction_id = ?
    `;

    db.run(query, [payment_status, transaction_id], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update payment status' });
        }
        res.status(200).json({ transaction_id, status: payment_status });
    });
});

// Route to check payment status
app.get('/check_payment_status/:transaction_id', (req, res) => {
    const { transaction_id } = req.params;

    const query = `
        SELECT * FROM Payment WHERE transaction_id = ?
    `;

    db.get(query, [transaction_id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to retrieve payment status' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(200).json({ transaction_id: row.transaction_id, status: row.status });
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
