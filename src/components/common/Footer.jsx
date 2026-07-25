import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* Brand Section — spans the full width on mobile (2-col grid) so the
              blurb has room to breathe, then collapses to one column at md+. */}
          <div className="col-span-2 md:col-span-1">
            {/* Links to home for a consistent, clickable brand mark */}
            <BrandLogo to="/" className="mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Connecting customers with trusted handymen across Singapore. Quality service, guaranteed satisfaction.
            </p>
          </div>

          {/* Services Section — each links to the job request flow.
              Previously href="#" placeholders, which failed the
              jsx-a11y/anchor-is-valid lint rule. */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Services</h4>
            <ul className="space-y-2">
              <li><Link to="/request-job" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Plumbing</Link></li>
              <li><Link to="/request-job" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Electrical</Link></li>
              <li><Link to="/request-job" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Carpentry</Link></li>
              <li><Link to="/request-job" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Painting</Link></li>
              <li><Link to="/request-job" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Air-con Servicing</Link></li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Support</h4>
            <ul className="space-y-2">
              <li><Link to="/help" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Help Center</Link></li>
              <li><Link to="/contact" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Contact Us</Link></li>
              <li><Link to="/terms-of-service" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">phone</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">+65 6123 4567</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">mail</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm break-all">easydonehandyman@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">location_on</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">Singapore</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-6 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center sm:text-left">
              &copy; 2025 EasyDoneHandyman. All rights reserved.
            </p>
            {/* Social placeholders — rendered as buttons (no real
                destinations yet) so they don't trip jsx-a11y. Wire up
                href values once the social accounts exist. */}
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Website" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">language</span>
              </button>
              <button type="button" aria-label="Facebook" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">facebook</span>
              </button>
              <button type="button" aria-label="Email" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">alternate_email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;