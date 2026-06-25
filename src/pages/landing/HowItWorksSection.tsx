// src/pages/landing/Landing/HowItWorksSection.tsx

import { motion } from 'framer-motion';

const steps = [
  {
    step: '01',
    title: 'Create Account',
    desc:  'Sign up in seconds with your email. No credit card required.',
  },
  {
    step: '02',
    title: 'Choose Your Niche',
    desc:  'Pick the industry that matches your products and get a tailored store.',
  },
  {
    step: '03',
    title: 'Set Up Your Store',
    desc:  'Add your products, pick a theme, and customize your brand.',
  },
  {
    step: '04',
    title: 'Start Selling',
    desc:  'Publish your store and start receiving orders with secure payments.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Live in 4 Simple Steps
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              <div className="text-6xl font-bold text-orange-100 dark:text-orange-950 mb-4">
                {item.step}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {item.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {item.desc}
              </p>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-orange-100 dark:bg-orange-950" />
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}