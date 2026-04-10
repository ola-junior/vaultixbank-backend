const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

dotenv.config({ path: '../.env' });

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Transaction.deleteMany({});
    console.log('Cleared existing data');

    // Create test users
    const users = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        accountNumber: await User.generateAccountNumber(),
        balance: 150000,
        phoneNumber: '08012345678'
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        accountNumber: await User.generateAccountNumber(),
        balance: 250000,
        phoneNumber: '08087654321'
      },
      {
        name: 'Mike Johnson',
        email: 'mike@example.com',
        password: 'password123',
        accountNumber: await User.generateAccountNumber(),
        balance: 50000,
        phoneNumber: '08055555555'
      }
    ];

    const createdUsers = await User.create(users);
    console.log(`Created ${createdUsers.length} users`);

    // Create sample transactions
    const transactions = [];
    
    for (const user of createdUsers) {
      // Credit transactions
      for (let i = 0; i < 5; i++) {
        transactions.push({
          userId: user._id,
          type: 'credit',
          amount: Math.floor(Math.random() * 50000) + 1000,
          status: 'successful',
          description: 'Salary deposit',
          balanceAfter: user.balance
        });
      }
      
      // Debit transactions
      for (let i = 0; i < 3; i++) {
        transactions.push({
          userId: user._id,
          type: 'debit',
          amount: Math.floor(Math.random() * 20000) + 500,
          status: 'successful',
          description: 'Purchase',
          balanceAfter: user.balance
        });
      }
    }

    await Transaction.create(transactions);
    console.log(`Created ${transactions.length} transactions`);

    console.log('Database seeded successfully!');
    console.log('\nTest Users:');
    console.log('--------------');
    console.log('Email: john@example.com | Password: password123');
    console.log('Email: jane@example.com | Password: password123');
    console.log('Email: mike@example.com | Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();