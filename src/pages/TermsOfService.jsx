import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Terms of Service Page
 * Displays the platform's terms of service
 */
const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
            <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
            </svg>
            <span className="text-xl font-bold text-gray-900 dark:text-white">EasyDone Handyman</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 md:p-10">

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Last Updated: October 1, 2026</p>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Welcome to EasyDone Handyman ("Platform", "we", "us", or "our"). These Terms of Service ("Terms") govern your access to and use of our website, mobile application, and services that connect customers with independent handyman service providers.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
              By accessing or using our Platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Definitions</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li><strong>"Customer"</strong> refers to any user who requests handyman services through the Platform.</li>
              <li><strong>"Handyman"</strong> or <strong>"Service Provider"</strong> refers to independent contractors who offer handyman services through the Platform.</li>
              <li><strong>"Job"</strong> refers to a service request created by a Customer and fulfilled by a Handyman.</li>
              <li><strong>"Service Fee"</strong> refers to the amount payable to the Handyman for completing a Job.</li>
              <li><strong>"Platform Fee"</strong> refers to the fee charged by EasyDone Handyman for facilitating the transaction.</li>
              <li><strong>"Total Amount"</strong> refers to the combined Service Fee and Platform Fee paid by the Customer.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Platform Description</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              EasyDone Handyman is an online marketplace that connects Customers with independent Handymen for home repair and maintenance services. We do not directly provide handyman services. Handymen are independent contractors and not employees of EasyDone Handyman.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.1 Our Role</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>A platform for Customers to request services</li>
              <li>A marketplace for Handymen to find work opportunities</li>
              <li>Secure payment processing</li>
              <li>Communication tools between parties</li>
              <li>Escrow services to protect both parties</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">3.2 What We Are Not</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>We are not a handyman service provider</li>
              <li>We do not employ Handymen</li>
              <li>We do not guarantee the quality of work performed</li>
              <li>We do not supervise or control how Handymen perform their services</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. User Accounts</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              To use our Platform, you must:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Be at least 18 years of age</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          {/* Section 5 - Payment Terms */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Payment Terms</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">5.1 Pricing</h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Service prices are displayed on our Platform and include:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300 mb-4">
              <li><strong>Service Fee</strong>: The base fee for the handyman service</li>
              <li><strong>Platform Fee</strong>: A 10% fee charged on top of the Service Fee</li>
            </ul>

            {/* Example Pricing Table */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Example Pricing:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Service Fee</span>
                  <span className="font-medium text-gray-900 dark:text-white">$100.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Platform Fee (10%)</span>
                  <span className="font-medium text-gray-900 dark:text-white">$10.00</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="font-semibold text-gray-900 dark:text-white">Total Amount</span>
                  <span className="font-bold text-primary">$110.00</span>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">5.2 Payment Breakdown</h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              When a Customer pays for a service, the Total Amount is distributed as follows:
            </p>

            {/* Payment Breakdown Table */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Detailed Example ($110 Total):</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Customer Pays</span>
                  <span className="font-medium text-gray-900 dark:text-white">$110.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Stripe Processing Fee (~3.4% + $0.50)</span>
                  <span className="font-medium text-red-600">-$4.24</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Net Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">$105.76</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Platform Fee</span>
                  <span className="font-medium text-blue-600">$9.61</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="font-semibold text-gray-900 dark:text-white">Handyman Receives</span>
                  <span className="font-bold text-green-600">$96.15</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                *Stripe processing fees may vary based on card type and region.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">5.3 Escrow and Fund Release</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li><strong>Payment Authorization</strong>: When a Customer confirms a job, payment is authorized and held securely.</li>
              <li><strong>Job Completion</strong>: The Handyman marks the job as complete upon finishing the work.</li>
              <li><strong>Customer Confirmation</strong>: The Customer confirms job completion via WhatsApp notification.</li>
              <li><strong>Fund Release</strong>: Upon confirmation, funds are released to the Handyman's account.</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">5.4 Payout Timing</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Released funds are transferred immediately to the Handyman's connected Stripe
              account. The onward payout to the Handyman's bank account is processed by Stripe
              on a daily schedule and typically arrives within 2–4 business days of release.
              A connected account's first-ever payout may take longer (typically 7–14 days)
              due to Stripe's standard verification holds.
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              These timings are indicative only: bank payout timing is controlled by Stripe
              and the receiving bank, not by EasyDoneHandyman, and may vary with weekends,
              public holidays and Stripe's risk checks.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Job Process</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-3">Job Statuses</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-gray-700 dark:text-gray-300">Pending</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">Job created, awaiting Handyman</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-300">Accepted</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">Handyman assigned</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-yellow-700 dark:text-yellow-300">In Progress</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">Work has begun</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-700 dark:text-amber-300">Pending Confirmation</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">Awaiting Customer confirmation</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-300">Completed</span>
                  <span className="text-gray-600 dark:text-gray-300 text-right">Job finished, payment released</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Cancellation and Refunds</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-3">7.1 How Your Payment Is Held</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Your card is charged when you book (the Service Fee plus the Platform Fee)</li>
              <li>We hold the payment. It is only paid out to the handyman after you confirm the job is complete and we release it</li>
              <li>Until we release the payment to the handyman, it can be refunded to you in full</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">7.2 Cancelling a Job</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>To cancel, contact us on WhatsApp at +65 9229 8812 or email easydonehandyman@gmail.com — there is no cancel button in the app</li>
              <li><strong>Before the job is done</strong> (whether or not a handyman has accepted it): full refund of everything you paid, including the Platform Fee. We do not charge a cancellation or administrative fee</li>
              <li><strong>If no handyman accepts your job</strong>, or your handyman cancels or does not turn up and we cannot arrange another: full refund</li>
              <li><strong>If you paid a price adjustment</strong> for extra work, it is refunded together with your original payment</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">7.3 Problems With Completed Work</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>If you report a problem when we ask you to confirm completion, we keep holding the payment while we look into it</li>
              <li>Depending on what happened, we may arrange for the work to be redone, or give a partial or full refund. We decide case by case after hearing from both you and the handyman</li>
              <li>Once we have released the payment to the handyman, we cannot automatically refund it. Contact us and we will review your case</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">7.4 Refund Processing</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Refunds are processed by our team, usually within 2 business days of being agreed</li>
              <li>Refunds go back to the card you paid with. Your bank typically takes 5–10 business days to show it</li>
              <li>You will receive an email receipt from our payment provider, Stripe, when the refund is issued</li>
              <li>We cover the card processing fees — you are refunded the full amount you paid</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">8. User Obligations</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-3">For Handymen</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Perform services professionally and competently</li>
              <li>Maintain all required licenses and permits</li>
              <li>Carry appropriate insurance coverage</li>
              <li>Comply with local laws and regulations</li>
              <li>Not solicit Customers outside the Platform</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">For Customers</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Provide accurate job descriptions</li>
              <li>Provide safe access to the work area</li>
              <li>Pay the full amount for completed services</li>
              <li>Confirm job completion promptly</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              EasyDone Handyman is not liable for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Quality or outcome of services provided by Handymen</li>
              <li>Property damage caused by Handymen</li>
              <li>Personal injury during service provision</li>
              <li>Delays or cancellations by Handymen</li>
              <li>Technical issues or Platform downtime</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
              Our maximum liability for any claim shall not exceed the Platform Fee paid for the relevant Job.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">10. Governing Law</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of Singapore. Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">11. Contact Information</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              For questions about these Terms, please contact us:
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="font-semibold text-gray-900 dark:text-white">EasyDone Handyman</p>
              <p className="text-gray-600 dark:text-gray-300">Email: easydonehandyman@gmail.com</p>
            </div>
          </section>

          {/* Agreement Notice */}
          <div className="mt-10 p-4 bg-primary/10 dark:bg-primary/20 rounded-lg">
            <p className="text-gray-700 dark:text-gray-200 text-sm text-center">
              By using EasyDone Handyman, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>

          {/* Back Link */}
          <div className="mt-8 text-center">
            <Link to="/" className="text-primary hover:underline font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
