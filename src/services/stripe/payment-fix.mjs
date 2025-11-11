// Just the payment intent creation section - fixed
const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: STRIPE_CONFIG.currency,

  // Payment method types - card only for now (cards support manual capture)
  payment_method_types: ['card'],

  // Capture method: manual means we hold the funds until we manually capture
  // This is perfect for escrow - funds are authorized but not yet charged
  capture_method: 'manual',

  // Receipt email
  receipt_email: customerEmail || null,

  // Description for the payment
  description: `${serviceType} service - Job #${jobId}`,

  // Metadata for tracking
  metadata: {
    jobId: jobId,
    customerId: customerId,
    handymanId: handymanId,
    serviceFee: serviceFee.toString(),
    platformFee: platformFee.toString(),
    totalAmount: totalAmount.toString(),
    serviceType: serviceType,
    platform: 'handyman-platform',
  },

  // Statement descriptor (shows on customer's card statement)
  statement_descriptor: 'HANDYMAN SVC',
  statement_descriptor_suffix: serviceType.substring(0, 10),
});
