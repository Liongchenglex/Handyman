import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * HelpContact Component
 *
 * Comprehensive help and contact page with FAQ section and contact details
 * Supports auto-scrolling to contact section when accessed from header
 */
const HelpContact = () => {
  const [openFaqItem, setOpenFaqItem] = useState(null);
  const location = useLocation();

  // Auto-scroll to contact section if coming from header contact link
  useEffect(() => {
    if (location.hash === '#contact') {
      const contactSection = document.getElementById('contact-section');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  const toggleFaqItem = (index) => {
    setOpenFaqItem(openFaqItem === index ? null : index);
  };

  // FAQ data with comprehensive self-help resources
  const faqItems = [
    {
      category: "Job Management",
      items: [
        {
          question: "No one is accepting my job request. What should I do?",
          answer: "If your job isn't getting responses, try these steps: 1) Check if your budget is competitive for the service type. 2) Add more details to your job description. 3) Upload photos if relevant. 4) Consider marking your job as 'urgent' if it's time-sensitive. 5) Expand your service area if possible. Most jobs receive responses within 24-48 hours."
        },
        {
          question: "How do I cancel my job request?",
          answer: "You can cancel your job request before a handyman accepts it without any penalty. Once accepted, cancellation fees may apply: $20 if cancelled before work starts, $50 if cancelled after work begins. To cancel, contact our support team or use the 'Cancel Job' option in your job details."
        },
        {
          question: "Can I modify my job details after posting?",
          answer: "Minor changes like contact details or additional notes can be made before a handyman accepts your job. For major changes (service type, budget, location), you may need to cancel and create a new job request. Contact support for assistance with modifications."
        },
        {
          question: "How long does it take to find a handyman?",
          answer: "Most jobs receive interest within 2-4 hours. Urgent jobs typically get faster responses. Factors affecting response time include: service type availability, your location, budget competitiveness, and job complexity. We recommend waiting 24 hours before considering adjustments."
        }
      ]
    },
    {
      category: "Payments & Refunds",
      items: [
        {
          question: "How does the payment system work?",
          answer: "We use a secure escrow system: 1) You pay upfront when posting your job. 2) Payment is held securely until job completion. 3) Handyman starts work after acceptance. 4) You confirm completion and release payment. 5) Funds are transferred to the handyman. This protects both parties."
        },
        {
          question: "When can I get a refund?",
          answer: "Full refunds are available: 1) If no handyman accepts your job within 7 days. 2) If the accepted handyman doesn't show up or cancels. 3) If work quality doesn't meet basic standards (subject to review). Partial refunds may apply for incomplete work. Refunds are processed within 3-5 business days."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept: PayNow (instant transfer), PayLah! (DBS digital wallet), and all major credit/debit cards via Stripe. All payments are processed securely with bank-level encryption. You'll receive email confirmations for all transactions."
        },
        {
          question: "Are there any hidden fees?",
          answer: "No hidden fees! Our pricing is transparent: Service fee (set by handyman), Platform fee (5% of service cost), Payment processing fee (2.9% for cards, free for PayNow/PayLah). All fees are shown clearly before payment."
        }
      ]
    },
    {
      category: "Disputes & Issues",
      items: [
        {
          question: "What if I'm not satisfied with the work quality?",
          answer: "If you're unsatisfied: 1) First, discuss concerns directly with the handyman. 2) Document issues with photos if possible. 3) Contact our support team within 24 hours of completion. 4) We'll mediate and may arrange re-work or partial refund. 5) For serious issues, we offer dispute resolution services."
        },
        {
          question: "The handyman didn't show up. What now?",
          answer: "If a handyman doesn't show up: 1) Try contacting them via WhatsApp or phone. 2) Wait 30 minutes past agreed time. 3) Report the no-show to our support team. 4) We'll contact the handyman and may reassign your job. 5) You'll receive full refund if we can't resolve within 24 hours."
        },
        {
          question: "How do I report inappropriate behavior?",
          answer: "Report any inappropriate behavior immediately: 1) Contact our 24/7 support hotline. 2) Provide details of the incident. 3) We'll investigate within 2 hours. 4) Serious violations result in immediate account suspension. 5) We may involve authorities for safety concerns. Your safety is our priority."
        },
        {
          question: "What if there's damage to my property?",
          answer: "For property damage: 1) Document with photos immediately. 2) Don't release payment until resolved. 3) Contact support within 6 hours. 4) We'll coordinate with the handyman's insurance. 5) Claims are processed through our damage protection program. Keep all documentation for insurance purposes."
        }
      ]
    },
    {
      category: "Account & Safety",
      items: [
        {
          question: "How do you verify handymen?",
          answer: "All handymen undergo: 1) NRIC/passport verification. 2) Background checks. 3) Skills assessment. 4) Insurance verification. 5) Reference checks. 6) Ongoing performance monitoring. Only verified professionals can accept jobs on our platform."
        },
        {
          question: "Is my personal information safe?",
          answer: "Yes, we use bank-level security: 1) All data encrypted with SSL. 2) Contact details only shared after job acceptance. 3) Payment information never stored. 4) Regular security audits. 5) GDPR compliant data handling. We never sell your information to third parties."
        },
        {
          question: "Can I choose my handyman?",
          answer: "Currently, handymen express interest in your job, and we notify you of matches. You can view their profiles, ratings, and experience before confirming. In the future, we'll add features to browse and directly select preferred handymen based on reviews and specializations."
        },
        {
          question: "What if I need to change my contact details?",
          answer: "Update your contact details in your account settings or contact support. Important: If you change your phone number, update it immediately as we use WhatsApp for job coordination. Email changes require verification for security."
        }
      ]
    },
    {
      category: "Technical Support",
      items: [
        {
          question: "The app/website isn't working properly. What should I do?",
          answer: "For technical issues: 1) Refresh your browser or restart the app. 2) Clear browser cache/cookies. 3) Check your internet connection. 4) Try using a different browser. 5) Contact support with error screenshots. We monitor system status 24/7 and resolve issues quickly."
        },
        {
          question: "I'm not receiving WhatsApp notifications. Why?",
          answer: "Check these: 1) Verify your phone number is correct. 2) Ensure WhatsApp is installed and active. 3) Check if you've blocked our business number. 4) Verify notification permissions. 5) Contact support to resend test messages. We also send email backups for important notifications."
        },
        {
          question: "How do I delete my account?",
          answer: "To delete your account: 1) Complete or cancel any active jobs. 2) Contact support with your deletion request. 3) We'll process within 48 hours. 4) All personal data will be permanently deleted. 5) You'll receive confirmation email. Note: Some transaction records may be retained for legal compliance."
        }
      ]
    }
  ];

  const contactInfo = [
    {
      icon: "phone",
      title: "Customer Support Hotline",
      details: "+65 8888 1234",
      subtext: "Available 24/7 for urgent issues"
    },
    {
      icon: "chat",
      title: "WhatsApp Support",
      details: "+65 8888 1234",
      subtext: "Quick responses during business hours"
    },
    {
      icon: "email",
      title: "Email Support",
      details: "support@handysg.com",
      subtext: "Detailed inquiries and documentation"
    },
    {
      icon: "location_on",
      title: "Business Address",
      details: "123 Orchard Road, #12-34\nSingapore 238826",
      subtext: "Monday - Friday, 9 AM - 6 PM"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Help & Support
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Find answers to common questions or get in touch with our support team.
            We're here to help make your HandySG experience smooth and successful.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <button
            onClick={() => document.getElementById('faq-section').scrollIntoView({ behavior: 'smooth' })}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="material-symbols-outlined text-primary text-2xl mb-2 block">help</span>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Browse FAQ</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Find quick answers</p>
          </button>

          <button
            onClick={() => document.getElementById('contact-section').scrollIntoView({ behavior: 'smooth' })}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="material-symbols-outlined text-primary text-2xl mb-2 block">support_agent</span>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Contact Support</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Get personal help</p>
          </button>

          <a
            href="tel:+6588881234"
            className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl p-6 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors text-center"
          >
            <span className="material-symbols-outlined text-primary text-2xl mb-2 block">emergency</span>
            <h3 className="font-semibold text-primary mb-1">Emergency Support</h3>
            <p className="text-sm text-primary/80">Call now: +65 8888 1234</p>
          </a>
        </div>

        {/* FAQ Section */}
        <div id="faq-section" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>

          {faqItems.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  {category.category === 'Job Management' ? 'work' :
                   category.category === 'Payments & Refunds' ? 'payment' :
                   category.category === 'Disputes & Issues' ? 'gavel' :
                   category.category === 'Account & Safety' ? 'security' : 'settings'}
                </span>
                {category.category}
              </h3>

              <div className="space-y-3">
                {category.items.map((faq, faqIndex) => {
                  const globalIndex = categoryIndex * 100 + faqIndex;
                  const isOpen = openFaqItem === globalIndex;

                  return (
                    <div
                      key={faqIndex}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaqItem(globalIndex)}
                        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <h4 className="font-medium text-gray-900 dark:text-white pr-4">
                          {faq.question}
                        </h4>
                        <span className={`material-symbols-outlined text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed pt-4">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Still Need Help Section */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-8 mb-12 text-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Still need help?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Can't find what you're looking for? Our support team is ready to assist you personally.
          </p>
          <button
            onClick={() => document.getElementById('contact-section').scrollIntoView({ behavior: 'smooth' })}
            className="bg-primary text-black font-bold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Contact Support Team
          </button>
        </div>

        {/* Contact Section */}
        <div id="contact-section" className="scroll-mt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Contact Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {contactInfo.map((contact, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-3">
                    <span className="material-symbols-outlined text-primary">
                      {contact.icon}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {contact.title}
                    </h3>
                    <p className="text-gray-900 dark:text-white font-medium mb-1 whitespace-pre-line">
                      {contact.details}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {contact.subtext}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Response Time Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                schedule
              </span>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Expected Response Times
                </h4>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li>• <strong>Emergency calls:</strong> Immediate response during business hours</li>
                  <li>• <strong>WhatsApp messages:</strong> Within 30 minutes during business hours</li>
                  <li>• <strong>Email inquiries:</strong> Within 2-4 hours on weekdays</li>
                  <li>• <strong>Complex issues:</strong> Full resolution within 24-48 hours</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpContact;