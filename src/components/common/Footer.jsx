import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* Brand Section */}
          <div className="col-span-1 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
              </svg>
              <span className="text-xl font-bold text-gray-900 dark:text-white">HandySG</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Connecting customers with trusted handymen across Singapore. Quality service, guaranteed satisfaction.
            </p>
          </div>

          {/* Services Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Services</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Plumbing</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Electrical</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Carpentry</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Painting</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Air-con Servicing</a></li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Support</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Help Center</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Contact Us</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Terms of Service</a></li>
              <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">phone</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">+65 XXXX XXXX</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">mail</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">support@handysg.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                <span className="text-gray-600 dark:text-gray-400 text-sm">Singapore</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-6 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center sm:text-left">
              &copy; 2024 HandySG. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">language</span>
              </a>
              <a href="#" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">facebook</span>
              </a>
              <a href="#" className="text-gray-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">alternate_email</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;