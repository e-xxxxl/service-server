// scripts/createAdmin.js
//
// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123!' node scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function createAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const fullName = process.env.ADMIN_SEED_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD environment variables are required.');
    console.error("Usage: ADMIN_SEED_EMAIL=you@example.com ADMIN_SEED_PASSWORD='StrongPass123!' node scripts/createAdmin.js");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ADMIN_SEED_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await Admin.create({
    email: email.toLowerCase().trim(),
    password,
    fullName,
    role: 'super_admin'
  });

  console.log('Admin created:', admin.email);
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});