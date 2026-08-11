// controllers/paymentController.js
const crypto = require('crypto');
const Conversation = require('../models/Conversation');
const ServiceProvider = require('../models/ServiceProvider');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const paystackService = require('../services/paystackService');
const emailService = require('../services/emailService');
const { notifyUser } = require('../services/notificationService');
const { emitNewMessage } = require('../socket');

// Platform commission is taken only from the workmanship portion of a
// quote, never from materials or other costs.
const PLATFORM_COMMISSION_RATE = 0.15;
// PAUSED: commission collection is switched off for now - providers are
// paid the full quote amount. Flip this back to true to re-enable the 15%
// cut (see platformCommission below); rate is left in place so no formula
// needs to be re-derived when that happens.
const COMMISSION_ENABLED = false;

// Runs once a Paystack payment is confirmed successful, whichever of the
// webhook or the /verify fallback gets there first. `transaction` must
// already be the freshly-flipped ('pending' -> 'success') document — the
// atomic findOneAndUpdate that produced it is what makes this whole flow
// idempotent, so this function assumes it is only ever called once per
// transaction.
async function fulfillPayment(transaction) {
  const conversation = await Conversation.findById(transaction.conversation);
  if (!conversation) {
    console.error('Payment fulfillment: conversation not found', transaction.conversation);
    return;
  }

  const message = conversation.messages.id(transaction.messageId);
  if (message?.quote) {
    message.quote.status = 'paid';
  }

  conversation.messages.push({
    sender: transaction.customer,
    senderModel: 'User',
    text: `Payment of ₦${transaction.amount.toLocaleString()} confirmed. This job is now active.`,
    messageType: 'payment_confirmed',
    payment: {
      status: 'paid',
      amount: transaction.amount,
      reference: transaction.reference,
      method: 'paystack',
      paidAt: transaction.paidAt || new Date()
    },
    createdAt: new Date()
  });

  conversation.bookingStatus = 'active';
  conversation.contactUnlocked = true;
  conversation.lastMessageAt = new Date();
  conversation.providerUnread = true;
  conversation.job = {
    ...conversation.job,
    deadline: message?.quote?.deadline || conversation.job?.deadline
  };
  const saved = await conversation.save();

  // Provider's wallet is credited the payout (total minus the platform's
  // commission on workmanship), never the full customer-paid amount.
  const providerPayout = transaction.providerPayout ?? transaction.amount;
  const provider = await ServiceProvider.findByIdAndUpdate(
    transaction.provider,
    { $inc: { 'wallet.balance': providerPayout, 'wallet.totalEarnings': providerPayout } },
    { new: true }
  ).populate('user', 'fullName email');

  const customer = await User.findById(transaction.customer);

  await Promise.all([
    notifyUser(transaction.customer, {
      text: `✅ Payment of ₦${transaction.amount.toLocaleString()} confirmed. Contact details are now available in this conversation.`,
      kind: 'success',
      relatedConversation: conversation._id
    }),
    provider?.user
      ? notifyUser(provider.user._id, {
          text: `💰 You've been paid ₦${providerPayout.toLocaleString()}. It's now in your wallet.`,
          kind: 'success',
          relatedConversation: conversation._id
        })
      : Promise.resolve()
  ]);

  if (provider?.user) {
    const savedMessage = saved.messages[saved.messages.length - 1].toObject();
    emitNewMessage({
      conversationId: conversation._id,
      recipientUserId: provider.user._id,
      message: { ...savedMessage, senderName: customer?.fullName },
      senderName: customer?.fullName
    });
  }

  const emailJobs = [];
  if (customer) {
    emailJobs.push(
      emailService.sendPaymentConfirmationEmail(customer, {
        isProvider: false,
        otherPartyName: provider?.companyName,
        amount: transaction.amount,
        reference: transaction.reference
      })
    );
  }
  if (provider?.user) {
    emailJobs.push(
      emailService.sendPaymentConfirmationEmail(provider.user, {
        isProvider: true,
        otherPartyName: customer?.fullName,
        amount: providerPayout,
        reference: transaction.reference
      })
    );
  }
  // Email failures shouldn't break payment fulfillment - log and move on.
  await Promise.allSettled(emailJobs);
}

class PaymentController {
  // POST /api/payment/initialize
  static async initialize(req, res) {
    try {
      const { conversationId, messageId } = req.body;
      const userId = req.user.id;

      if (!conversationId || !messageId) {
        return res.status(400).json({ success: false, message: 'conversationId and messageId are required' });
      }

      const conversation = await Conversation.findOne({ _id: conversationId, customer: userId });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const message = conversation.messages.id(messageId);
      if (!message || message.messageType !== 'quote' || !message.quote) {
        return res.status(400).json({ success: false, message: 'Quote not found on this conversation' });
      }

      if (message.quote.status !== 'accepted') {
        return res.status(400).json({ success: false, message: 'This quote must be accepted before it can be paid for' });
      }

      const amount = message.quote.totalAmount;
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid quote amount' });
      }

      // Platform commission is taken only from the workmanship portion,
      // never from materials or other costs - the provider is reimbursed
      // for those in full. Currently paused - see COMMISSION_ENABLED.
      const workmanshipCost = message.quote.workmanshipCost || 0;
      const platformCommission = COMMISSION_ENABLED
        ? Math.round(workmanshipCost * PLATFORM_COMMISSION_RATE)
        : 0; // Math.round(workmanshipCost * PLATFORM_COMMISSION_RATE)
      const providerPayout = amount - platformCommission;

      const customer = await User.findById(userId);
      const reference = `PSK-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

      const paystackData = await paystackService.initializeTransaction({
        email: customer.email,
        amountNaira: amount,
        reference,
        callbackUrl: `${process.env.CLIENT_URL}/dashboard?payment=callback&reference=${reference}`,
        metadata: { conversationId, messageId, customerId: userId }
      });

      await Transaction.create({
        reference,
        customer: userId,
        provider: conversation.professional,
        conversation: conversationId,
        messageId,
        amount,
        workmanshipCost,
        platformCommission,
        providerPayout,
        status: 'pending',
        paystackData: {
          authorizationUrl: paystackData.authorization_url,
          accessCode: paystackData.access_code
        }
      });

      res.json({
        success: true,
        data: { authorizationUrl: paystackData.authorization_url, reference, amount }
      });
    } catch (error) {
      console.error('Payment initialize error:', error);
      res.status(500).json({ success: false, message: 'Failed to start payment. Please try again.' });
    }
  }

  // GET /api/payment/verify/:reference
  static async verify(req, res) {
    try {
      const { reference } = req.params;
      const transaction = await Transaction.findOne({ reference });

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }
      if (transaction.customer.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this transaction' });
      }

      if (transaction.status === 'success') {
        return res.json({ success: true, data: { status: 'success', amount: transaction.amount } });
      }
      if (transaction.status === 'failed') {
        return res.json({ success: true, data: { status: 'failed' } });
      }

      const paystackResult = await paystackService.verifyTransaction(reference);

      // Defense in depth: Paystack's own verify response is the authoritative
      // amount actually charged. Even though nothing on our side lets a
      // client alter the amount (it was fixed server-side at /initialize),
      // we still refuse to credit anything if what Paystack confirms doesn't
      // match what we expected for this reference.
      const amountMatches = paystackResult.amount === Math.round(transaction.amount * 100);

      if (paystackResult.status === 'success' && amountMatches) {
        // Atomic: only the first caller to observe status:'pending' flips it.
        // A webhook delivery racing this request is a guaranteed no-op on
        // the loser, so the wallet is credited exactly once either way.
        const updated = await Transaction.findOneAndUpdate(
          { reference, status: 'pending' },
          { status: 'success', paidAt: new Date(), 'paystackData.channel': paystackResult.channel, 'paystackData.gatewayResponse': paystackResult.gateway_response },
          { new: true }
        );

        if (updated) {
          await fulfillPayment(updated);
        }

        return res.json({ success: true, data: { status: 'success', amount: transaction.amount } });
      }

      if (paystackResult.status === 'success' && !amountMatches) {
        console.error('Payment verify: amount mismatch, refusing to credit', { reference, expected: transaction.amount, paystackAmount: paystackResult.amount });
        await Transaction.findOneAndUpdate({ reference, status: 'pending' }, { status: 'failed' });
        return res.status(409).json({ success: false, message: 'Payment amount could not be verified. Please contact support.' });
      }

      await Transaction.findOneAndUpdate({ reference, status: 'pending' }, { status: 'failed' });
      res.json({ success: true, data: { status: 'failed' } });
    } catch (error) {
      console.error('Payment verify error:', error);
      res.status(500).json({ success: false, message: 'We could not confirm your payment. Your account has not been charged again — please check your payment status and try again.' });
    }
  }

  // POST /api/payment/webhook (public, signature-verified, raw body)
  static async webhook(req, res) {
    try {
      const signature = req.headers['x-paystack-signature'];
      const secret = paystackService.getSecretKey();
      const computed = crypto.createHmac('sha512', secret).update(req.body).digest('hex');

      if (!signature || computed !== signature) {
        console.warn('Paystack webhook: invalid signature');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }

      const event = JSON.parse(req.body.toString('utf8'));

      if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const transaction = await Transaction.findOne({ reference });
        const amountMatches = transaction && event.data.amount === Math.round(transaction.amount * 100);

        if (transaction && !amountMatches) {
          console.error('Payment webhook: amount mismatch, refusing to credit', { reference, expected: transaction.amount, webhookAmount: event.data.amount });
        }

        if (transaction && transaction.status === 'pending' && amountMatches) {
          const updated = await Transaction.findOneAndUpdate(
            { reference, status: 'pending' },
            {
              status: 'success',
              paidAt: new Date(),
              'paystackData.channel': event.data.channel,
              'paystackData.gatewayResponse': event.data.gateway_response
            },
            { new: true }
          );

          if (updated) {
            await fulfillPayment(updated);
          }
        }
      }

      // Always 200 quickly so Paystack doesn't retry-storm us; unmatched/
      // already-processed events are intentionally silent no-ops above.
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      res.status(200).json({ success: false }); // ack anyway to stop Paystack retries; logged for follow-up
    }
  }
}

module.exports = PaymentController;
