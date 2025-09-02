'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView, Variants } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
  border: string;
}

interface Stat {
  number: string;
  label: string;
}

const HabitTrackerLanding: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeTestimonial, setActiveTestimonial] = useState<number>(0);
  const [email, setEmail] = useState<string>('');
  const { scrollYProgress } = useScroll();
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);

  const heroInView = useInView(heroRef, { once: true });
  const featuresInView = useInView(featuresRef, { once: true });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  const testimonials: Testimonial[] = [
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

  const features: Feature[] = [
    {
      icon: "🎯",
      title: "One-Tap Check-ins",
      description: "Mark habits complete with a single tap. No forms, no complexity.",
      color: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
      border: "border-blue-200 dark:border-blue-800"
    },
    {
      icon: "🔒",
      title: "Privacy First",
      description: "Your data stays secure. Share only what you choose to share.",
      color: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
      border: "border-green-200 dark:border-green-800"
    },
    {
      icon: "📊",
      title: "Visual Streaks",
      description: "See your progress at a glance with clean, minimal streak counters.",
      color: "from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20",
      border: "border-purple-200 dark:border-purple-800"
    },
    {
      icon: "🤝",
      title: "Quiet Accountability",
      description: "Add one trusted buddy for gentle support without social pressure.",
      color: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20",
      border: "border-orange-200 dark:border-orange-800"
    },
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Optimized for speed. Works seamlessly across all your devices.",
      color: "from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20",
      border: "border-cyan-200 dark:border-cyan-800"
    },
    {
      icon: "📱",
      title: "Always Available",
      description: "Works beautifully on desktop, tablet, and mobile devices.",
      color: "from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20",
      border: "border-pink-200 dark:border-pink-800"
    }
  ];

  const stats: Stat[] = [
    { number: "10,000+", label: "Active Users" },
    { number: "2.5M+", label: "Habits Tracked" },
    { number: "89%", label: "Success Rate" },
    { number: "4.9★", label: "User Rating" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  // Fixed Framer Motion variants with proper TypeScript typing
  const fadeInUp: Variants = {
    hidden: { 
      opacity: 0, 
      y: 60 
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as any // Type assertion for custom easing
      }
    }
  };

  const staggerChildren: Variants = {
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle email signup here
    console.log('Email submitted:', email);
    setEmail('');
  };

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-800">
      {/* Navigation */}
      <motion.nav
        className="fixed top-0 w-full z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-600 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">
                Streaks
              </span>
            </motion.div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a 
                href="#features" 
                className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
              >
                Features
              </a>
              <a 
                href="#testimonials" 
                className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
              >
                Reviews
              </a>
              <Link href="/login">
                <motion.button
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-lg hover:shadow-xl"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started Free
                </motion.button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle menu"
            >
              <div className="w-6 h-6 flex flex-col justify-center items-center">
                <motion.span
                  className="w-5 h-0.5 bg-gray-900 dark:bg-white block"
                  animate={{ rotate: isMenuOpen ? 45 : 0, y: isMenuOpen ? 6 : 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="w-5 h-0.5 bg-gray-900 dark:bg-white block mt-1"
                  animate={{ opacity: isMenuOpen ? 0 : 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="w-5 h-0.5 bg-gray-900 dark:bg-white block mt-1"
                  animate={{ rotate: isMenuOpen ? -45 : 0, y: isMenuOpen ? -6 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-4 py-6 space-y-4">
                <a 
                  href="#features" 
                  className="block text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#testimonials" 
                  className="block text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Reviews
                </a>
                <Link href="/login">
                  <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 font-medium shadow-lg">
                    Get Started Free
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="pt-32 pb-16 px-4 sm:px-6 lg:px-8"
        style={{ y, opacity }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              className="text-center lg:text-left"
              variants={staggerChildren}
              initial="hidden"
              animate={heroInView ? "visible" : "hidden"}
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-8 border border-indigo-200/50 dark:border-indigo-800/50"
              >
                <span className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mr-2 animate-pulse"></span>
                Free forever • No credit card required
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-[0.9] mb-8 tracking-tight"
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
                className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed"
              >
                The minimalist habit tracker designed for privacy, simplicity, and real progress. No overwhelm, just results.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
              >
                <Link href="/login">
                  <motion.button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all duration-300"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start Your First Streak
                  </motion.button>
                </Link>
                <motion.button
                  className="border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-10 py-4 rounded-2xl text-lg font-semibold hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/20 dark:hover:to-purple-900/20 transition-all duration-300"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={scrollToFeatures}
                >
                  Learn More
                </motion.button>
              </motion.div>

              <motion.div
                variants={fadeInUp}
                className="flex items-center justify-center lg:justify-start space-x-8 text-sm text-gray-500 dark:text-gray-400"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-green-500 text-lg">✓</span>
                  <span className="font-medium">Always free</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500 text-lg">✓</span>
                  <span className="font-medium">Privacy focused</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500 text-lg">✓</span>
                  <span className="font-medium">No ads</span>
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
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md mx-auto border border-white/20 dark:border-gray-700/50"
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
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Today's Habits</h3>
                    <div className="text-2xl">📅</div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { emoji: "💧", name: "Drink Water", completed: true },
                      { emoji: "🏃", name: "Morning Run", completed: true },
                      { emoji: "📚", name: "Read 20min", completed: true },
                      { emoji: "🧘", name: "Meditate", completed: false }
                    ].map((habit, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50/80 to-indigo-50/50 dark:from-gray-700/50 dark:to-indigo-900/20 rounded-xl backdrop-blur-sm border border-gray-200/30 dark:border-gray-600/30"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{habit.emoji}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{habit.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <motion.div
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                              habit.completed
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {habit.completed && (
                              <motion.span
                                className="text-white text-sm font-bold"
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
                    className="mt-8 text-center p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/30"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current streak</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">🔥 12 days</div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Floating elements with improved design */}
              <motion.div
                className="absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl border-4 border-white/20"
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 3, repeat: Infinity }
                }}
              >
                <span className="text-3xl">⚡</span>
              </motion.div>

              <motion.div
                className="absolute -bottom-6 -left-6 w-16 h-16 bg-gradient-to-br from-green-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl border-4 border-white/20"
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, -10, 0]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <span className="text-2xl">🎯</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            variants={fadeInUp}
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Everything you need,
              <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">nothing you don't</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
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
                className={`p-8 rounded-3xl bg-gradient-to-br ${feature.color} border ${feature.border} hover:shadow-xl transition-all duration-500 backdrop-blur-sm`}
                whileHover={{ scale: 1.03, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-5xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-20 bg-gradient-to-r from-indigo-50 via-purple-50 to-teal-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-teal-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                className="p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-white/30 dark:border-gray-700/30 shadow-lg"
              >
                <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Loved by habit builders everywhere
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See what our users are saying about their journey
            </p>
          </motion.div>

          <div className="relative max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="text-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-800/50 dark:to-indigo-900/20 p-12 rounded-3xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm"
              >
                <div className="text-7xl mb-8 text-indigo-200 dark:text-indigo-800">❝</div>
                <blockquote className="text-2xl sm:text-3xl text-gray-900 dark:text-white font-medium mb-10 leading-relaxed">
                  {testimonials[activeTestimonial].quote}
                </blockquote>
                <div className="flex items-center justify-center space-x-6">
                  <div className="text-5xl">{testimonials[activeTestimonial].avatar}</div>
                  <div className="text-left">
                    <div className="font-bold text-xl text-gray-900 dark:text-white">{testimonials[activeTestimonial].author}</div>
                    <div className="text-gray-600 dark:text-gray-400 text-lg">{testimonials[activeTestimonial].role}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Testimonial indicators */}
            <div className="flex justify-center space-x-3 mt-10">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    index === activeTestimonial 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                  }`}
                  onClick={() => setActiveTestimonial(index)}
                  aria-label={`View testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
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

            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-6 py-4 rounded-xl border-white text-lg w-full focus:outline-none focus:ring-4 focus:ring-white/20 text-gray-900"
                required
              />
              <Link href="/login">
                <motion.button
                  type="button"
                  className="bg-white text-indigo-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 shadow-lg w-full sm:w-auto whitespace-nowrap"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started Free
                </motion.button>
              </Link>
            </form>

            <p className="text-indigo-200 text-sm">
              Free forever • No credit card required • Start in seconds
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 py-16 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-1">
              <div className="flex items-center space-x-3 mb-4">
               <Image src="/logo.svg" alt="Streaks Logo" width={132} height={32} />
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The habit tracker designed for real people who want real results without the complexity.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-12 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              © 2025 Streaks. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 sm:mt-0">
              <span className="text-sm text-gray-600 dark:text-gray-300">Made with care for habit builders</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HabitTrackerLanding;
