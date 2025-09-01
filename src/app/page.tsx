"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';

const HabitTrackerLanding = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [email, setEmail] = useState('');
  const { scrollYProgress } = useScroll();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);

  const heroInView = useInView(heroRef, { once: true });
  const featuresInView = useInView(featuresRef, { once: true });
  const pricingInView = useInView(pricingRef, { once: true });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const testimonials = [
    {
      quote: "Finally, a habit tracker that doesn't overwhelm me. The simplicity is refreshing.",
      author: "Sarah Chen",
      role: "Product Designer",
      avatar: "👩‍💻"
    },
    {
      quote: "The buddy feature keeps me accountable without the social media pressure.",
      author: "Marcus Johnson",
      role: "Software Engineer",
      avatar: "👨‍💻"
    },
    {
      quote: "Privacy-first approach convinced me. My data stays mine.",
      author: "Elena Rodriguez",
      role: "Freelancer",
      avatar: "👩‍🎨"
    }
  ];

  const features = [
    {
      icon: "🎯",
      title: "One-Tap Check-ins",
      description: "Mark habits complete with a single tap. No forms, no complexity.",
      color: "from-blue-50 to-indigo-50"
    },
    {
      icon: "🔒",
      title: "Privacy First",
      description: "Your data stays on your device. Share only what you choose to share.",
      color: "from-green-50 to-emerald-50"
    },
    {
      icon: "📊",
      title: "Visual Streaks",
      description: "See your progress at a glance with clean, minimal streak counters.",
      color: "from-purple-50 to-violet-50"
    },
    {
      icon: "🤝",
      title: "Quiet Accountability",
      description: "Add one trusted buddy for gentle support without social pressure.",
      color: "from-orange-50 to-amber-50"
    },
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Optimized for speed. Works offline, syncs when connected.",
      color: "from-cyan-50 to-sky-50"
    },
    {
      icon: "📱",
      title: "Cross-Platform",
      description: "Works beautifully on desktop, tablet, and mobile devices.",
      color: "from-pink-50 to-rose-50"
    }
  ];

  const plans = [
    {
      name: "Free",
      price: "0",
      period: "forever",
      description: "Perfect for getting started",
      features: ["Up to 3 habits", "7-day streak tracking", "Basic analytics", "Mobile app"],
      cta: "Get Started",
      popular: false,
      color: "border-gray-200"
    },
    {
      name: "Pro",
      price: "9",
      period: "month",
      description: "For serious habit builders",
      features: ["Unlimited habits", "Full streak history", "Advanced analytics", "Buddy system", "Public sharing", "Priority support"],
      cta: "Start Free Trial",
      popular: true,
      color: "border-indigo-200 ring-2 ring-indigo-100"
    },
    {
      name: "Team",
      price: "29",
      period: "month",
      description: "For teams and organizations",
      features: ["Everything in Pro", "Team dashboards", "Admin controls", "Custom integrations", "Bulk user management", "Enterprise support"],
      cta: "Contact Sales",
      popular: false,
      color: "border-gray-200"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      {/* Navigation */}
      <motion.nav
        className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="font-bold text-xl text-gray-900">Streaks</span>
            </motion.div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">Reviews</a>
              <motion.button
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-6 h-6 flex flex-col justify-center items-center">
                <motion.span
                  className="w-6 h-0.5 bg-gray-900 block"
                  animate={{ rotate: isMenuOpen ? 45 : 0, y: isMenuOpen ? 6 : 0 }}
                />
                <motion.span
                  className="w-6 h-0.5 bg-gray-900 block mt-1"
                  animate={{ opacity: isMenuOpen ? 0 : 1 }}
                />
                <motion.span
                  className="w-6 h-0.5 bg-gray-900 block mt-1"
                  animate={{ rotate: isMenuOpen ? -45 : 0, y: isMenuOpen ? -6 : 0 }}
                />
              </div>
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="md:hidden bg-white border-t border-gray-100"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#features" className="block text-gray-600 hover:text-gray-900">Features</a>
                <a href="#pricing" className="block text-gray-600 hover:text-gray-900">Pricing</a>
                <a href="#testimonials" className="block text-gray-600 hover:text-gray-900">Reviews</a>
                <button className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="pt-24 pb-12 px-4 sm:px-6 lg:px-8"
        style={{ y, opacity }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              className="text-center lg:text-left"
              variants={staggerChildren}
              initial="hidden"
              animate={heroInView ? "visible" : "hidden"}
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-6"
              >
                <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
                Now in beta • Join 10,000+ users
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6"
              >
                Build habits that
                <motion.span
                  className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 bg-clip-text text-transparent"
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{ duration: 8, repeat: Infinity }}
                  style={{
                    backgroundSize: '200% 100%'
                  }}
                >
                  actually stick
                </motion.span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-xl text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0"
              >
                The minimalist habit tracker designed for privacy, simplicity, and real progress. No overwhelm, just results.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
              >
                <motion.button
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Start Your First Streak
                </motion.button>
                <motion.button
                  className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Watch Demo
                </motion.button>
              </motion.div>

              <motion.div
                variants={fadeInUp}
                className="flex items-center justify-center lg:justify-start space-x-6 text-sm text-gray-500"
              >
                <div className="flex items-center space-x-1">
                  <span className="text-green-500">✓</span>
                  <span>Free forever plan</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-green-500">✓</span>
                  <span>No credit card required</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Visual */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={heroInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative z-10">
                <motion.div
                  className="bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-auto"
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 1, 0]
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">Today's Habits</h3>
                    <div className="text-2xl">📅</div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { emoji: "💧", name: "Drink Water", progress: 7, total: 8, color: "blue" },
                      { emoji: "🏃", name: "Morning Run", progress: 1, total: 1, color: "green" },
                      { emoji: "📚", name: "Read 20min", progress: 1, total: 1, color: "purple" },
                      { emoji: "🧘", name: "Meditate", progress: 0, total: 1, color: "orange" }
                    ].map((habit, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{habit.emoji}</span>
                          <span className="font-medium text-gray-900">{habit.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm text-gray-500">
                            {habit.progress}/{habit.total}
                          </div>
                          <motion.div
                            className={`w-6 h-6 rounded-full border-2 ${
                              habit.progress >= habit.total
                                ? `bg-${habit.color}-500 border-${habit.color}-500`
                                : `border-gray-300`
                            } flex items-center justify-center`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {habit.progress >= habit.total && (
                              <motion.span
                                className="text-white text-xs"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring" }}
                              >
                                ✓
                              </motion.span>
                            )}
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    className="mt-6 text-center"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="text-sm text-gray-500 mb-1">Current streak</div>
                    <div className="text-3xl font-bold text-orange-500">🔥 12 days</div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Floating elements */}
              <motion.div
                className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg"
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 3, repeat: Infinity }
                }}
              >
                <span className="text-2xl">⚡</span>
              </motion.div>

              <motion.div
                className="absolute -bottom-4 -left-4 w-12 h-12 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg"
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, -10, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <span className="text-xl">🎯</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            variants={fadeInUp}
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Everything you need,
              <span className="block text-indigo-600">nothing you don't</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We've stripped away the noise and focused on what actually helps you build lasting habits.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={staggerChildren}
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className={`p-8 rounded-2xl bg-gradient-to-br ${feature.color} border border-gray-100 hover:shadow-lg transition-all duration-300`}
                whileHover={{ scale: 1.02, y: -5 }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {[
              { number: "10,000+", label: "Active Users" },
              { number: "2.5M+", label: "Habits Tracked" },
              { number: "89%", label: "Success Rate" },
              { number: "4.9★", label: "App Store Rating" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, type: "spring" }}
              >
                <div className="text-3xl sm:text-4xl font-bold text-indigo-600 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Loved by habit builders everywhere
            </h2>
            <p className="text-xl text-gray-600">
              See what our users are saying about their journey
            </p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <div className="text-6xl mb-6">❝</div>
                <blockquote className="text-2xl text-gray-900 font-medium mb-8 leading-relaxed">
                  {testimonials[activeTestimonial].quote}
                </blockquote>
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-4xl">{testimonials[activeTestimonial].avatar}</div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{testimonials[activeTestimonial].author}</div>
                    <div className="text-gray-600">{testimonials[activeTestimonial].role}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Testimonial indicators */}
            <div className="flex justify-center space-x-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === activeTestimonial ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                  onClick={() => setActiveTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" ref={pricingRef} className="py-20 bg-gradient-to-br from-gray-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            variants={fadeInUp}
            initial="hidden"
            animate={pricingInView ? "visible" : "hidden"}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free, upgrade when you're ready to unlock your full potential
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            variants={staggerChildren}
            initial="hidden"
            animate={pricingInView ? "visible" : "hidden"}
          >
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className={`bg-white rounded-2xl p-8 shadow-lg ${plan.color} ${
                  plan.popular ? 'transform scale-105' : ''
                } relative`}
                whileHover={{ scale: plan.popular ? 1.05 : 1.02, y: -5 }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                      : 'border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {plan.cta}
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ready to build habits that last?
            </h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Join thousands of users who've transformed their lives one habit at a time.
              Start your journey today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-6 py-4 rounded-xl text-lg w-full sm:w-80 focus:outline-none focus:ring-4 focus:ring-white/20"
              />
              <motion.button
                className="bg-white text-indigo-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 shadow-lg w-full sm:w-auto"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Free Trial
              </motion.button>
            </div>

            <p className="text-indigo-200 text-sm">
              14-day free trial • No credit card required • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="font-bold text-xl text-gray-900">Streaks</span>
              </div>
              <p className="text-gray-600 mb-6">
                The habit tracker designed for real people who want real results without the complexity.
              </p>
              <div className="flex space-x-4">
                <motion.a
                  href="#"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </motion.a>
                <motion.a
                  href="#"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                  </svg>
                </motion.a>
                <motion.a
                  href="#"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.221.083.342-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.162-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.001 12.017.001z" clipRule="evenodd"/>
                  </svg>
                </motion.a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">API</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Press</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 mt-12 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-gray-600 text-sm">
              © 2025 Streaks. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 sm:mt-0">
              <span className="text-sm text-gray-600">Made with ❤️ for habit builders</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HabitTrackerLanding;