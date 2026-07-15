// scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const admin = await Admin.create({
    email: 'admin@9jatradiesPages.com',
    password: 'SuperemeAdmin@@##123!',
    fullName: 'Super Admin',
    role: 'super_admin'
  });
  
  console.log('Admin created:', admin.email);
  process.exit(0);
}

createAdmin();