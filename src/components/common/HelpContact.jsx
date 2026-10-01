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
          answer: "As soon as your payment goes through, we notify the handymen on our platform. If nobody has accepted your job after a few days, our team will contact you to either find a handyman for you or give you a full refund. You can also message us on WhatsApp at +65 9229 8812 at any time to check on it."
        },
        {
          question: "How do I cancel my job request?",
          answer: "Message us on WhatsApp at +65 9229 8812 or email easydonehandyman@gmail.com with your Job number — there is no cancel button in the app. If the job hasn't been done yet, we refund everything you paid, including the platform fee. There are no cancellation fees."
        },
        {
          question: "Can I modify my job details after posting?",
          answer: "Jobs can't be edited in the app. Message us on WhatsApp at +65 9229 8812 with your Job number and the change you need — we'll update it or, if it changes the job significantly, cancel it with a full refund so you can book again. To change the visit time after a handyman accepts, the handyman can propose a new time or we can send you a link to pick one."
        },
        {
          question: "How long does it take to find a handyman?",
          answer: "It depends on the type of job, the time you need and which handymen are available. Every handyman on the platform is notified as soon as you book. If it's taking longer than expected, message us and we'll help."
        }
      ]
    },
    {
      category: "Payments & Refunds",
      items: [
        {
          question: "How does the payment system work?",
          answer: "1) Your card is charged when you book (service fee + 10% platform fee). 2) We hold the payment — the handyman is not paid yet. 3) After the job, we ask you on WhatsApp to confirm it's complete. 4) Once you confirm, our team releases the payment to the handyman. Until then, your money can be refunded in full."
        },
        {
          question: "When can I get a refund?",
          answer: "You get a full refund (including the platform fee) if: 1) you cancel before the job is done, 2) no handyman accepts your job, or 3) your handyman cancels or doesn't turn up and we can't arrange another. If there's a problem with completed work, report it when we ask you to confirm completion — we hold the payment and decide case by case (re-work, partial or full refund). Refunds are processed by our team, usually within 2 business days, and take 5–10 business days to reach your card."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept credit and debit cards (Visa, Mastercard and others supported by Stripe). Payments are processed securely by Stripe, and you'll receive an email receipt from Stripe."
        },
        {
          question: "Are there any hidden fees?",
          answer: "No. You pay the service fee shown for your job plus a 10% platform fee — the total is shown before you pay. If your handyman finds more work is needed on site, they can request a price adjustment; you only pay it if you agree, using the link we send you. There are no card processing or cancellation fees."
        }
      ]
    },
    {
      category: "Disputes & Issues",
      items: [
        {
          question: "What if I'm not satisfied with the work quality?",
          answer: "When we ask you on WhatsApp to confirm the job is complete, tap 'Report Issue'. We keep holding your payment while our team talks to you and the handyman, and we decide case by case — the handyman may come back to fix it, or you may get a partial or full refund. If the same problem comes back within 48 hours after you confirmed the job, it's covered by our 48-hour warranty (see below)."
        },
        {
          question: "Is there a warranty on the work?",
          answer: "Yes — a 48-hour workmanship warranty. If the same problem comes back within 48 hours after you confirmed the job is complete, message us on WhatsApp at +65 9229 8812 with your Job number and photos. We'll arrange for the handyman to come back and fix it at no extra cost. The warranty covers the work the handyman did, not new or unrelated problems."
        },
        {
          question: "The handyman didn't show up. What now?",
          answer: "When we ask you on WhatsApp whether the job was completed, tap 'Report Issue' and then reply 2 ('the handyman never came') — or simply message us 'he never came'. You'll then choose: 1) reschedule with the same handyman, 2) get a new handyman, or 3) cancel for a full refund. Your payment stays protected throughout."
        },
        {
          question: "How do I report inappropriate behavior?",
          answer: "Message us on WhatsApp at +65 9229 8812 or email easydonehandyman@gmail.com with what happened and your Job number. We'll look into it as quickly as we can and may suspend the handyman's account. If you are in danger, call the police on 999 first."
        },
        {
          question: "What if there's damage to my property?",
          answer: "Take photos straight away and contact us on WhatsApp at +65 9229 8812 before confirming the job is complete — while you haven't confirmed, we are still holding the payment. We'll work with you and the handyman to resolve it. Please note we don't currently provide damage insurance or a damage protection programme."
        }
      ]
    },
    {
      category: "Account & Safety",
      items: [
        {
          question: "How do you verify handymen?",
          answer: "Every handyman applies with their personal details and their work experience or CV, which our team reviews and approves by hand before they can take jobs. Before a handyman can be paid, our payment provider Stripe verifies their identity and bank account. We don't currently run criminal background checks or skills tests."
        },
        {
          question: "Is my personal information safe?",
          answer: "Card payments are handled by Stripe — we never see or store your card number. Handymen browsing jobs can see the job description, address and your name; your phone number is only shared with the handyman who accepts your job. We don't sell your information. See our Privacy Policy for details."
        },
        {
          question: "Can I choose my handyman?",
          answer: "Not at the moment — the first available handyman who accepts your job is assigned to it. If you have a concern about your assigned handyman, message us and we can arrange a different one."
        },
        {
          question: "What if I need to change my contact details?",
          answer: "Customers don't need an account, so just message us on WhatsApp at +65 9229 8812 with your Job number and new details. Please do this quickly if your phone number changes — we use WhatsApp to coordinate your job."
        }
      ]
    },
    {
      category: "Technical Support",
      items: [
        {
          question: "The app/website isn't working properly. What should I do?",
          answer: "Try refreshing the page, using a different browser, or checking your internet connection. If it still doesn't work, send us a screenshot on WhatsApp at +65 9229 8812 or email easydonehandyman@gmail.com and we'll help."
        },
        {
          question: "I'm not receiving WhatsApp notifications. Why?",
          answer: "Check that the phone number on your booking is correct, that WhatsApp is installed on it, and that you haven't blocked our business number. If messages still don't arrive, contact us by email at easydonehandyman@gmail.com. Note: we send job updates by WhatsApp only (payment and refund receipts come by email from Stripe)."
        },
        {
          question: "How do I delete my account?",
          answer: "Contact us by email at easydonehandyman@gmail.com with your request. We'll delete your personal data once any active jobs are finished. Some payment records have to be kept for legal and accounting reasons."
        }
      ]
    }
  ];

  const contactInfo = [
    {
      icon: "phone",
      title: "WhatsApp / Phone",
      details: "+65 9229 8812",
      subtext: "WhatsApp or call — fastest way to reach us"
    },
    {
      icon: "email",
      title: "Email Support",
      details: "easydonehandyman@gmail.com",
      subtext: "Detailed inquiries and documentation"
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
            We're here to help make your EasyDoneHandyman experience smooth and successful.
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
            href="tel:+6592298812"
            className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl p-6 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors text-center"
          >
            <span className="material-symbols-outlined text-primary text-2xl mb-2 block">emergency</span>
            <h3 className="font-semibold text-primary mb-1">Emergency Support</h3>
            <p className="text-sm text-primary/80">Call now: +65 9229 8812</p>
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
                  <li>• <strong>WhatsApp/phone:</strong> We reply as soon as we can, usually the same day</li>
                  <li>• <strong>Email:</strong> Usually within 1 business day</li>
                  <li>• <strong>Refunds:</strong> Processed within 2 business days of being agreed</li>
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