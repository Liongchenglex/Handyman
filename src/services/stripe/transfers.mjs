/**
 * Stripe Transfer Service
 *
 * Handles all transfer operations including:
 * - Releasing escrow and splitting payments 3-ways (10/10/80)
 * - Transferring funds to connected accounts
 * - Tracking transfer status
 * - Handling transfer failures
 *
 * IMPORTANT: This file should only be used server-side
 */

import stripe, { STRIPE_CONFIG, calculateSplits, dollarsToCents } from './config.mjs';

/**
 * Release escrow and execute 3-way payment split
 *
 * This transfers funds from platform account to:
 * - Cofounder (10%)
 * - Operator (10%)
 * - Handyman (80%)
 *
 * @param {Object} releaseData - Release information
 * @param {string} releaseData.paymentIntentId - Payment intent ID
 * @param {string} releaseData.jobId - Job ID
 * @param {number} releaseData.serviceFee - Service fee in dollars
 * @param {string} releaseData.handymanAccountId - Handyman's Stripe account ID
 * @returns {Promise<Object>} Transfer results for all three parties
 */
export const releaseEscrowAndSplit = async (releaseData) => {
  try {
    const {
      paymentIntentId,
      jobId,
      serviceFee,
      handymanAccountId
    } = releaseData;

    console.log(`🔓 Releasing escrow for job: ${jobId}`);
    console.log(`   Payment Intent: ${paymentIntentId}`);
    console.log(`   Service Fee: $${serviceFee}`);

    // Calculate splits
    const splits = calculateSplits(serviceFee);

    console.log(`💰 Split breakdown:`);
    console.log(`   Cofounder: $${splits.cofounder} (${STRIPE_CONFIG.splits.cofounder * 100}%)`);
    console.log(`   Operator: $${splits.operator} (${STRIPE_CONFIG.splits.operator * 100}%)`);
    console.log(`   Handyman: $${splits.handyman} (${STRIPE_CONFIG.splits.handyman * 100}%)`);

    // Get connected account IDs
    const cofounderAccountId = STRIPE_CONFIG.connectedAccounts.cofounder;
    const operatorAccountId = STRIPE_CONFIG.connectedAccounts.operator;

    // Validate all accounts are configured
    if (!cofounderAccountId || !operatorAccountId) {
      throw new Error('Cofounder or Operator connected accounts not configured');
    }

    if (!handymanAccountId) {
      throw new Error('Handyman connected account not provided');
    }

    // Execute transfers in parallel for faster processing
    console.log(`📤 Executing transfers...`);

    const [cofounderTransfer, operatorTransfer, handymanTransfer] = await Promise.all([
      // Transfer to cofounder
      createTransfer({
        amount: splits.cofounder,
        destination: cofounderAccountId,
        description: `Cofounder share for job #${jobId}`,
        metadata: {
          jobId,
          paymentIntentId,
          recipient: 'cofounder',
          percentage: (STRIPE_CONFIG.splits.cofounder * 100).toString()
        }
      }),

      // Transfer to operator
      createTransfer({
        amount: splits.operator,
        destination: operatorAccountId,
        description: `Operator share for job #${jobId}`,
        metadata: {
          jobId,
          paymentIntentId,
          recipient: 'operator',
          percentage: (STRIPE_CONFIG.splits.operator * 100).toString()
        }
      }),

      // Transfer to handyman
      createTransfer({
        amount: splits.handyman,
        destination: handymanAccountId,
        description: `Handyman payment for job #${jobId}`,
        metadata: {
          jobId,
          paymentIntentId,
          recipient: 'handyman',
          percentage: (STRIPE_CONFIG.splits.handyman * 100).toString()
        }
      })
    ]);

    console.log(`✅ All transfers completed successfully`);

    return {
      success: true,
      splits: splits,
      transfers: {
        cofounder: cofounderTransfer,
        operator: operatorTransfer,
        handyman: handymanTransfer
      },
      transferIds: {
        cofounder: cofounderTransfer.transfer.id,
        operator: operatorTransfer.transfer.id,
        handyman: handymanTransfer.transfer.id
      }
    };
  } catch (error) {
    console.error('❌ Error releasing escrow and splitting payment:', error);
    throw new Error(`Failed to release escrow: ${error.message}`);
  }
};

/**
 * Create a single transfer to a connected account
 *
 * @param {Object} transferData - Transfer information
 * @param {number} transferData.amount - Amount in dollars
 * @param {string} transferData.destination - Connected account ID
 * @param {string} transferData.description - Transfer description
 * @param {Object} transferData.metadata - Metadata for tracking
 * @returns {Promise<Object>} Transfer object
 */
export const createTransfer = async (transferData) => {
  try {
    const { amount, destination, description, metadata } = transferData;

    // Skip transfer if amount is 0
    if (amount === 0) {
      console.log(`⏭️  Skipping transfer of $0 to ${destination}`);
      return {
        success: true,
        transfer: null,
        skipped: true
      };
    }

    const amountInCents = dollarsToCents(amount);

    console.log(`💸 Creating transfer: $${amount} → ${destination}`);

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: STRIPE_CONFIG.currency,
      destination: destination,
      description: description,
      metadata: metadata || {}
    });

    console.log(`✅ Transfer created: ${transfer.id}`);

    return {
      success: true,
      transfer: transfer,
      transferId: transfer.id,
      amount: amount
    };
  } catch (error) {
    console.error(`❌ Error creating transfer:`, error);
    throw new Error(`Failed to create transfer: ${error.message}`);
  }
};

/**
 * Get transfer status
 *
 * @param {string} transferId - Transfer ID
 * @returns {Promise<Object>} Transfer status
 */
export const getTransferStatus = async (transferId) => {
  try {
    console.log(`📊 Fetching transfer status: ${transferId}`);

    const transfer = await stripe.transfers.retrieve(transferId);

    const status = {
      id: transfer.id,
      amount: transfer.amount / 100, // Convert cents to dollars
      currency: transfer.currency,
      destination: transfer.destination,
      created: transfer.created,

      // Metadata
      jobId: transfer.metadata?.jobId,
      recipient: transfer.metadata?.recipient,

      // Reversal information (if reversed)
      reversed: transfer.reversed,
      reversals: transfer.reversals?.data || []
    };

    console.log(`✅ Transfer status retrieved`);

    return {
      success: true,
      status: status,
      transfer: transfer
    };
  } catch (error) {
    console.error('❌ Error fetching transfer status:', error);
    throw new Error(`Failed to fetch transfer status: ${error.message}`);
  }
};

/**
 * Reverse a transfer (refund to platform account)
 *
 * This can be used if you need to reverse a payment split
 * (e.g., job cancelled after payment released)
 *
 * @param {string} transferId - Transfer ID
 * @param {number} [amount] - Amount to reverse (optional, defaults to full amount)
 * @param {string} [reason] - Reason for reversal
 * @returns {Promise<Object>} Reversal object
 */
export const reverseTransfer = async (transferId, amount = null, reason = 'requested_by_platform') => {
  try {
    console.log(`↩️  Reversing transfer: ${transferId}`);

    const reversalData = {
      metadata: {
        reason: reason,
        reversedAt: new Date().toISOString()
      }
    };

    // If specific amount provided, add it (must be in cents)
    if (amount) {
      reversalData.amount = dollarsToCents(amount);
      console.log(`   Amount: $${amount}`);
    } else {
      console.log(`   Amount: Full transfer`);
    }

    const reversal = await stripe.transfers.createReversal(
      transferId,
      reversalData
    );

    console.log(`✅ Transfer reversed: ${reversal.id}`);

    return {
      success: true,
      reversal: reversal,
      reversalId: reversal.id,
      amount: reversal.amount / 100
    };
  } catch (error) {
    console.error('❌ Error reversing transfer:', error);
    throw new Error(`Failed to reverse transfer: ${error.message}`);
  }
};

/**
 * Reverse all transfers for a job (full refund)
 *
 * @param {Object} transferIds - Object with cofounder, operator, handyman transfer IDs
 * @returns {Promise<Object>} Reversal results
 */
export const reverseAllTransfers = async (transferIds) => {
  try {
    console.log(`🔄 Reversing all transfers for job`);

    const reversals = await Promise.all([
      transferIds.cofounder ? reverseTransfer(transferIds.cofounder) : Promise.resolve(null),
      transferIds.operator ? reverseTransfer(transferIds.operator) : Promise.resolve(null),
      transferIds.handyman ? reverseTransfer(transferIds.handyman) : Promise.resolve(null)
    ]);

    console.log(`✅ All transfers reversed`);

    return {
      success: true,
      reversals: {
        cofounder: reversals[0],
        operator: reversals[1],
        handyman: reversals[2]
      }
    };
  } catch (error) {
    console.error('❌ Error reversing all transfers:', error);
    throw new Error(`Failed to reverse all transfers: ${error.message}`);
  }
};

/**
 * Calculate working days from a start date
 *
 * Helper function to calculate auto-release date
 * Excludes weekends (Saturday & Sunday)
 *
 * @param {Date} startDate - Start date
 * @param {number} workingDays - Number of working days to add
 * @returns {Date} End date after working days
 */
export const addWorkingDays = (startDate, workingDays) => {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    currentDate.setDate(currentDate.getDate() + 1);

    // Check if it's a weekday (0 = Sunday, 6 = Saturday)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return currentDate;
};

/**
 * Calculate auto-release date based on config
 *
 * @param {Date} markedCompleteDate - Date when job was marked complete
 * @returns {Date} Auto-release date (3 working days later)
 */
export const calculateAutoReleaseDate = (markedCompleteDate) => {
  const workingDays = STRIPE_CONFIG.escrowAutoReleaseDays;
  return addWorkingDays(markedCompleteDate, workingDays);
};
