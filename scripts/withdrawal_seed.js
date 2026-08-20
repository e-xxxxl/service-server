// TEMPORARY - seeds disposable data for withdrawal system E2E test.
// Not committed, deleted after use.
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Admin = require('../models/Admin');
const Conversation = require('../models/Conversation');
const Transaction = require('../models/Transaction');
const JWTService = require('../config/jwt');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const customerUser = await User.create({
    email: 'wdtest.customer@example.com',
    password: 'TestPass123!',
    fullName: 'Withdrawal Test Customer',
    accountType: 'customer',
    isEmailVerified: true,
    state: 'Lagos',
    city: 'Agege'
  });

  const providerUser = await User.create({
    email: 'wdtest.provider@example.com',
    password: 'TestPass123!',
    fullName: 'Withdrawal Test Provider',
    accountType: 'provider',
    isEmailVerified: true
  });

  const provider = await ServiceProvider.create({
    user: providerUser._id,
    companyName: 'WD Test Electricals',
    serviceType: 'electricians',
    verificationStatus: 'approved',
    isVisible: true,
    isAvailable: true,
    city: 'Agege',
    state: 'Lagos'
  });

  const adminUser = await Admin.create({
    email: 'wdtest.admin@example.com',
    password: 'TestPass123!',
    fullName: 'Withdrawal Test Admin',
    role: 'admin'
  });

  // Conversation with a paid quote: workmanship 10,000 + materials 5,000 = 15,000
  const conversation = await Conversation.create({
    customer: customerUser._id,
    professional: provider._id,
    bookingStatus: 'active',
    contactUnlocked: true,
    messages: [{
      sender: providerUser._id,
      senderModel: 'ServiceProvider',
      text: 'Quote',
      messageType: 'quote',
      quote: {
        serviceDescription: 'Rewire sockets',
        workmanshipCost: 10000,
        materialCost: 5000,
        otherCosts: 0,
        totalAmount: 15000,
        status: 'paid'
      }
    }]
  });

  const reference = `WDTEST-${Date.now()}`;
  const transaction = await Transaction.create({
    reference,
    customer: customerUser._id,
    provider: provider._id,
    conversation: conversation._id,
    messageId: conversation.messages[0]._id,
    amount: 15000,
    workmanshipCost: 10000,
    platformCommission: 0,
    providerPayout: 15000,
    status: 'pending'
  });

  const customerToken = JWTService.generateToken({ _id: customerUser._id, email: customerUser.email, accountType: 'customer' });
  const providerToken = JWTService.generateToken({ _id: providerUser._id, email: providerUser.email, accountType: 'provider' });
  const adminToken = JWTService.generateToken({ _id: adminUser._id, id: adminUser._id, email: adminUser.email, accountType: 'admin', fullName: adminUser.fullName, role: adminUser.role });

  // Build a validly-HMAC-signed webhook payload for this transaction so it
  // can be fired at POST /api/payment/webhook to trigger fulfillPayment
  // through the real code path.
  const webhookBody = JSON.stringify({
    event: 'charge.success',
    data: {
      reference,
      amount: 15000 * 100,
      channel: 'card',
      gateway_response: 'Successful'
    }
  });
  const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(webhookBody).digest('hex');

  console.log(JSON.stringify({
    customerUserId: customerUser._id.toString(),
    providerUserId: providerUser._id.toString(),
    providerId: provider._id.toString(),
    adminId: adminUser._id.toString(),
    conversationId: conversation._id.toString(),
    transactionId: transaction._id.toString(),
    reference,
    customerToken,
    providerToken,
    adminToken,
    webhookBody,
    signature
  }));

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
