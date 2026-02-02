import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Privacy Policy Page
 * Displays the platform's privacy policy
 */
const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
            <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
            </svg>
            <span className="text-xl font-bold text-gray-900 dark:text-white">EazyDone Handyman</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 md:p-10">

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Last Updated: February 2, 2026</p>

          {/* Section 1 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              EazyDone Handyman ("we", "us", "our", or "Platform") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and services.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
              By using our Platform, you consent to the data practices described in this Privacy Policy. If you do not agree with this Privacy Policy, please do not use our Platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li><strong>Account Information</strong>: Name, email address, phone number, password</li>
              <li><strong>Profile Information</strong>: Profile photo, bio, skills, certifications</li>
              <li><strong>Payment Information</strong>: Credit card details, bank account information (processed by Stripe)</li>
              <li><strong>Service Information</strong>: Job descriptions, addresses, service preferences</li>
              <li><strong>Communications</strong>: Messages, reviews, feedback, support inquiries</li>
              <li><strong>Identity Verification</strong>: Government ID, photos, background check information (for Handymen)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li><strong>Device Information</strong>: Device type, operating system, browser type, unique device identifiers</li>
              <li><strong>Usage Data</strong>: Pages visited, features used, time spent on Platform, click patterns</li>
              <li><strong>Location Data</strong>: GPS location, IP address, service addresses</li>
              <li><strong>Log Data</strong>: Access times, error logs, referring URLs</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Payment processors (Stripe)</li>
              <li>Social media platforms (if connected)</li>
              <li>Background check providers (for Handymen)</li>
              <li>Analytics providers</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Platform Operations</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Create and manage accounts, process transactions, connect users, facilitate communication, provide customer support.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Platform Improvement</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Analyze usage patterns, develop new features, improve user experience, conduct research and analytics.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Communications</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Send service notifications, promotional materials, respond to inquiries, send surveys.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Safety and Security</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Verify identities, detect and prevent fraud, enforce Terms of Service, comply with legal obligations.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Sharing of Information</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-3">4.1 With Other Users</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Customers can view Handyman profiles (name, photo, ratings, service areas)</li>
              <li>Handymen can view Customer job details and contact information for assigned jobs</li>
              <li>Reviews and ratings are publicly visible</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">4.2 With Service Providers</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-2">We may share information with third-party vendors including:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Payment processing (Stripe)</li>
              <li>Cloud hosting and storage</li>
              <li>Analytics and performance monitoring</li>
              <li>Marketing and advertising platforms</li>
              <li>Communication services (SMS, email, WhatsApp)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">4.3 For Legal Reasons</h3>
            <p className="text-gray-600 dark:text-gray-300">
              We may disclose information to comply with legal obligations, respond to lawful requests from authorities, protect our rights, or investigate potential violations.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Cookies and Tracking</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Remember your preferences and settings</li>
              <li>Authenticate your sessions</li>
              <li>Analyze Platform usage</li>
              <li>Deliver targeted advertisements</li>
              <li>Measure marketing effectiveness</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
              Most browsers allow you to manage cookie preferences. However, disabling cookies may affect Platform functionality.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Data Retention</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              We retain your information for as long as:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Your account is active</li>
              <li>Necessary to provide our services</li>
              <li>Required for legitimate business purposes</li>
              <li>Required by law or regulation</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
              After account deletion, we may retain certain information for legal compliance, dispute resolution, and in anonymized form for analytics.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Data Security</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              We implement reasonable security measures to protect your information, including:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure server infrastructure</li>
              <li>Access controls and authentication</li>
              <li>Regular security assessments</li>
            </ul>
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Note:</strong> No method of transmission or storage is 100% secure. We cannot guarantee absolute security of your information.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">8. Your Rights and Choices</h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-1">edit</span>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Account Information</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Update or correct your account information through profile settings.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-1">mail</span>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Marketing Communications</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Opt out of promotional emails by clicking "unsubscribe".</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-1">location_off</span>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Location Data</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Disable location services through your device settings.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-1">delete</span>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Account Deletion</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Request account deletion by contacting us.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">9. Singapore PDPA Compliance</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              For users in Singapore, we process personal data in accordance with the Personal Data Protection Act (PDPA). This includes:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>Obtaining consent for collection, use, and disclosure</li>
              <li>Allowing withdrawal of consent (subject to legal restrictions)</li>
              <li>Providing access to and correction of personal data upon request</li>
              <li>Protecting personal data with reasonable security arrangements</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be effective upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">11. Contact Us</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              For questions about this Privacy Policy or our data practices, please contact:
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="font-semibold text-gray-900 dark:text-white">EazyDone Handyman</p>
              <p className="text-gray-600 dark:text-gray-300">Email: easydonehandyman@gmail.com</p>
              <p className="text-gray-600 dark:text-gray-300">Data Protection Officer: easydonehandyman@gmail.com</p>
            </div>
          </section>

          {/* Consent Notice */}
          <div className="mt-10 p-4 bg-primary/10 dark:bg-primary/20 rounded-lg">
            <p className="text-gray-700 dark:text-gray-200 text-sm text-center">
              By using EazyDone Handyman, you acknowledge that you have read and understood this Privacy Policy and consent to the collection, use, and disclosure of your information as described.
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

export default PrivacyPolicy;
