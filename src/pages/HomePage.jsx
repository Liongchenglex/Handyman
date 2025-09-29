import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  // Ensure page scrolls to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  // Static featured handymen data
  const featuredHandymen = [
    {
      id: 1,
      name: "David Tan",
      speciality: "Plumbing & Electrical",
      rating: 4.9,
      completedJobs: 234,
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      badge: "Top Rated"
    },
    {
      id: 2,
      name: "Sarah Lim",
      speciality: "Carpentry & Furniture",
      rating: 4.8,
      completedJobs: 187,
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b6d4c07b?w=150&h=150&fit=crop&crop=face",
      badge: "Most Popular"
    },
    {
      id: 3,
      name: "Ahmad Rahman",
      speciality: "Aircon & Appliances",
      rating: 4.9,
      completedJobs: 156,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      badge: "Fast Response"
    }
  ];

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200">
      {/* Hero Banner Section */}
      <div className="relative">
        <div className="flex flex-col items-center justify-center h-[70vh] p-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-auto text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"></path>
              </svg>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-4">HandySG</h1>
              <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-400">Your trusted partner for home services in Singapore.</p>
            </div>
            <div className="space-y-3">
              <Link
                to="/request-job"
                className="group flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-base sm:text-lg font-bold text-background-dark transition-transform duration-300 hover:scale-105"
              >
                <span className="material-symbols-outlined mr-3">construction</span>
                I need a handyman
              </Link>
              <Link
                to="/handyman-dashboard"
                className="group flex w-full items-center justify-center rounded-lg bg-primary/20 dark:bg-primary/30 px-6 py-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white transition-transform duration-300 hover:scale-105"
              >
                <span className="material-symbols-outlined mr-3">engineering</span>
                I am a handyman
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* Featured Handymen Section */}
      <div className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Featured Handymen
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Meet our top-rated professionals ready to help you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredHandymen.map((handyman) => (
              <div
                key={handyman.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6"
              >
                {/* Badge */}
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-block bg-primary/20 dark:bg-primary/30 text-primary text-xs font-bold px-3 py-1 rounded-full">
                    {handyman.badge}
                  </span>
                </div>

                {/* Avatar and Basic Info */}
                <div className="text-center mb-4">
                  <img
                    src={handyman.avatar}
                    alt={handyman.name}
                    className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                  />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {handyman.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {handyman.speciality}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-yellow-500 text-sm">star</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {handyman.rating}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {handyman.completedJobs} jobs
                  </div>
                </div>

                {/* Contact Button */}
                <button className="w-full mt-4 bg-primary/10 dark:bg-primary/20 text-primary font-medium py-2 px-4 rounded-lg hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors duration-200">
                  View Profile
                </button>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-12">
            <Link
              to="/handymen"
              className="inline-flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary font-medium py-3 px-6 rounded-lg hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors duration-200"
            >
              View All Handymen
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        <p>&copy; 2024 HandySG. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;