// src/pages/landing/Landing/FooterSection.tsx

import { Link } from 'react-router-dom';
import { Globe, Users, ShoppingBag } from 'lucide-react';
import CONFIG from '@/lib/config';
import { blogLinks } from './constants';

interface Props {
  onScrollToSection: (id: string) => void;
}

export default function FooterSection({ onScrollToSection }: Props) {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container-custom">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">

          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">QAFRICA</span>
            </div>
            <p className="text-gray-400 mb-4 leading-relaxed max-w-xs">
              Empowering Nigerian entrepreneurs to build, grow, and scale
              their online businesses.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                aria-label="Website"
                className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Globe className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="Community"
                className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Users className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Platform</h4>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => onScrollToSection('features')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('pricing')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Pricing
                </button>
              </li>
              <li>
                <Link
                  to="/stores"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Browse Stores
                </Link>
              </li>
              <li>
                <Link
                  to="/signup"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Start Free Trial
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Sell on Jumia & More
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Support</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`mailto:${CONFIG.PLATFORM_EMAIL}`}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <button
                  onClick={() => onScrollToSection('faq')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  FAQ
                </button>
              </li>
              <li>
                <Link
                  to="/developer/docs"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Developer API
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources — Blog links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Resources</h4>
            <ul className="space-y-3">
              {blogLinks.map((post) => (
                <li key={post.slug}>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="text-gray-400 hover:text-orange-500 transition-colors text-sm leading-snug block"
                  >
                    {post.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/blog"
                  className="text-orange-500 hover:text-orange-400 transition-colors text-sm font-semibold flex items-center gap-1 mt-1"
                >
                  View all articles →
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} QAFRICA. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Based in Nigeria</span>
            <span>·</span>
            <a
              href={`mailto:${CONFIG.PLATFORM_EMAIL}`}
              className="hover:text-orange-500 transition-colors"
            >
              {CONFIG.PLATFORM_EMAIL}
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}