import React, { useEffect, useState, useRef } from 'react';
import { Star, Moon, Sun, Sparkles, ChevronDown, BookOpen, Globe, Shield, Users, ArrowRight, Check, Move3d } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('principles');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (starsRef.current) {
      starsRef.current.style.transform = `translateY(${-scrollPosition * 0.2}px)`;
    }
  }, [scrollPosition]);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const chakraImages = [
    'https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
    'https://images.pexels.com/photos/6231351/pexels-photo-6231351.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
    'https://images.pexels.com/photos/8134843/pexels-photo-8134843.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
    'https://images.pexels.com/photos/5938553/pexels-photo-5938553.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop'
  ];

  const vedicPrinciples = [
    {
      title: "Karma & Dharma",
      description: "Vedic astrology reveals how your past actions (karma) shape your present and future, and helps you align with your life's purpose (dharma).",
      icon: <BookOpen className="w-6 h-6 text-purple-400" />
    },
    {
      title: "Cosmo Connection",
      description: "The positions of planets at your birth create a unique energetic blueprint that influences your personality, relationships, and life path.",
      icon: <Globe className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Remedial Solutions",
      description: "Vedic astrology offers practical remedies like mantras, gemstones, and rituals to harmonize planetary energies and overcome challenges.",
      icon: <Shield className="w-6 h-6 text-yellow-400" />
    },
    {
      title: "Cycles of Time",
      description: "Through dashas (planetary periods), Vedic astrology predicts life events and optimal timing for important decisions and actions.",
      icon: <Users className="w-6 h-6 text-pink-400" />
    }
  ];

  const faqs = [
    {
      question: "How is Vedic astrology different from Western astrology?",
      answer: "Vedic astrology uses the sidereal zodiac which accounts for Earth's precession, whereas Western astrology uses the tropical zodiac. Vedic focuses more on karma, life purpose, and predictive techniques."
    },
    {
      question: "What information do I need for a Vedic chart reading?",
      answer: "For an accurate reading, we need your exact birth time, date, and place of birth. This allows us to calculate your ascendant (Lagna) and planetary positions precisely."
    },
    {
      question: "How often should I consult my Vedic chart?",
      answer: "Major life transitions are ideal times for consultation. Many clients check during planetary transitions (Gochar) or at the start of new planetary periods (Dasha)."
    },
    {
      question: "Can Vedic astrology predict future events?",
      answer: "Vedic astrology identifies patterns and probabilities rather than fixed outcomes. It reveals potential challenges and opportunities, empowering you to make conscious choices."
    }
  ];

  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-gradient-to-b from-gray-900 via-indigo-900 to-gray-900">
      {/* Floating Chakra Images */}
      <div className="absolute inset-0 pointer-events-none">
        {chakraImages.map((img, index) => (
          <div
            key={index}
            className={`absolute opacity-20 rounded-full transition-all duration-1000 delay-${index * 200} ${
              isVisible ? 'translate-y-0 opacity-20' : 'translate-y-10 opacity-0'
            }`}
            style={{
              top: `${20 + (index * 20)}%`,
              left: `${10 + (index * 20)}%`,
              width: '80px',
              height: '80px',
              backgroundImage: `url('${img}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: `float ${3 + index}s ease-in-out infinite`
            }}
          />
        ))}
      </div>

      {/* Stars Background with Parallax Effect */}
      <div 
        ref={starsRef}
        className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 pointer-events-none"
        style={{ 
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'transform 0.1s ease-out',
          transform: `translateY(${-scrollPosition * 0.2}px)`
        }}
      />

      {/* Animated Shooting Stars */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-0"
            style={{
              top: `${15 + i * 25}%`,
              left: `${-5}%`,
              animation: `shootingStar ${15 + i * 5}s linear infinite`,
              animationDelay: `${i * 10}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Star className="text-purple-400 w-8 h-8 animate-pulse" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Cosmo Vedic
            </h1>
          </div>
          <div className="space-x-4">
            {/* <button
              onClick={onSignIn}
              className="px-6 py-2 text-white border border-purple-400/50 rounded-full hover:bg-purple-400/20 transition-all duration-300"
            >
              Sign In
            </button> */}
            <button
              onClick={onSignIn}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center group"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className={`text-center mb-20 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="inline-block mb-6 bg-purple-900/30 px-4 py-2 rounded-full border border-purple-400/30 animate-pulse">
            <span className="flex items-center text-purple-300">
              <Move3d className="mr-2 w-5 h-5" /> Precision Vedic Astrology
            </span>
          </div>
          <h2 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Discover Your Cosmo Blueprint
          </h2>
          <h3 className="text-5xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Through Vedic Wisdom
          </h3>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Unlock the ancient secrets of Jyotish (Vedic Astrology) to navigate life's challenges, fulfill your dharma, 
            and align with Cosmo rhythms. Our AI-powered platform combines timeless wisdom with modern technology for 
            personalized guidance.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onSignUp}
              className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Generate My Chart
            </button>
            <button className="px-10 py-4 text-white text-lg border border-purple-400/50 rounded-full hover:bg-purple-400/20 transition-all duration-300">
              Explore Vedic Wisdom
            </button>
          </div>
        </div>

        {/* Accuracy Warning Section */}
        <div className={`py-16 transition-all duration-1000 delay-500 ${
          isVisible ? 'opacity-100' : 'opacity-0 translate-y-10'
        }`}>
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-8 border border-purple-400/30 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-500/20 rounded-full blur-xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center mb-6">
                <div className="bg-red-500/20 p-2 rounded-lg mr-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                  Beware of Inaccurate AI Astrology
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-lg text-gray-300 mb-4">
                    Our research shows that <span className="text-red-300 font-bold">70% of AI-based astrology platforms</span> generate incorrect charts and make predictions without proper Vedic foundations.
                  </p>
                  <p className="text-gray-300">
                    Many platforms use oversimplified algorithms that fail to account for precise astronomical calculations, 
                    sidereal zodiac adjustments, and location-specific planetary positions.
                  </p>
                </div>
                
                <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
                  <h4 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Star className="mr-2 text-yellow-400 w-5 h-5" />
                    Cosmo Vedic's Precision Approach
                  </h4>
                  <ul className="space-y-3">
                    {[
                      "Millimeter-accurate planetary positions using NASA data",
                      "Validated by Vedic scholars from traditional lineages",
                      "AI trained on classical Sanskrit texts",
                      "Sidereal zodiac with precise ayanamsa calculation"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vedic Principles */}
        <div className={`py-16 transition-all duration-1000 delay-700 ${
          isVisible ? 'opacity-100' : 'opacity-0 translate-y-10'
        }`}>
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              The Pillars of Vedic Astrology
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Jyotish, the "science of light," offers a comprehensive framework for understanding life's patterns 
              through Cosmo influences
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {vedicPrinciples.map((principle, index) => (
              <div 
                key={index}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 hover:border-purple-400/50 transition-all duration-500 transform hover:-translate-y-2 delay-${index * 100} ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${800 + index * 100}ms` }}
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-purple-900/50 rounded-lg mr-4">
                    {principle.icon}
                  </div>
                  <h4 className="text-xl font-semibold text-white">{principle.title}</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  {principle.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Parallax Scrolling Section */}
        <div className="relative h-[500px] rounded-2xl overflow-hidden my-20 border border-purple-400/30">
          <div 
            className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534447677768-be436bb09401?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1790&q=80')] bg-cover bg-center"
            style={{ transform: `translateY(${-scrollPosition * 0.3}px)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-purple-900/70 to-gray-900" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              The Ancient Science of Light
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mb-8">
              Vedic astrology (Jyotish) is a 5,000-year-old mathematical system that reveals how Cosmo patterns 
              influence human consciousness and earthly events
            </p>
            <button 
              onClick={onSignUp}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
            >
              Explore Your Cosmo Design
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className={`py-16 transition-all duration-1000 delay-900 ${
          isVisible ? 'opacity-100' : 'opacity-0 translate-y-10'
        }`}>
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Your Personal Vedic Journey
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Explore comprehensive astrological insights tailored to your unique birth chart
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {[
              {
                icon: <Moon className="w-8 h-8 text-blue-400" />,
                title: "Birth Chart Analysis",
                description: "Deep insights into your Rasi (Moon sign), Navamsa (Soul sign), and planetary positions revealing karmic patterns and life purpose."
              },
              {
                icon: <Sun className="w-8 h-8 text-yellow-400" />,
                title: "Remedial Guidance",
                description: "Personalized gemstone recommendations, ritual guidance, and spiritual practices for planetary harmony."
              },
              {
                icon: <Sparkles className="w-8 h-8 text-purple-400" />,
                title: "Mantra & Meditation",
                description: "Sacred mantras and meditation techniques aligned with your chart to manifest abundance and spiritual growth."
              },
              {
                icon: <Star className="w-8 h-8 text-pink-400" />,
                title: "AI Astrologer",
                description: "24/7 access to our Vedic AI trained on classical texts like Brihat Parashara Hora Shastra."
              }
            ].map((card, index) => (
              <div
                key={index}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-500 transform hover:scale-105 delay-${index * 100} ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${1000 + index * 100}ms` }}
              >
                <div className="mb-4">
                  {card.icon}
                </div>
                <h4 className="text-xl font-semibold mb-3 text-white">
                  {card.title}
                </h4>
                <p className="text-gray-300 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="py-16">
          <div className={`text-center transition-all duration-1000 delay-1000 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h3 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Transform Your Life Through Cosmo Wisdom
            </h3>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Vedic astrology offers profound insights into your dharma, relationships, career, and spiritual path. 
              Our platform combines traditional knowledge with modern AI to provide accurate, personalized guidance 
              for every aspect of your life journey.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <h4 className="text-2xl font-semibold mb-4 text-white">Vedic Astrology vs Modern Life</h4>
              <ul className="space-y-4">
                {[
                  "Understand relationship compatibility through Graha Maitri (planetary friendships)",
                  "Navigate career crossroads with Arudha Lagna insights",
                  "Identify optimal timing for ventures using Muhurta",
                  "Balance health through planetary-dosha connections"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-8 border border-purple-400/30">
              <h4 className="text-2xl font-semibold mb-4 text-white">The Cosmo Advantage</h4>
              <p className="text-gray-300 mb-6">
                Vedic astrology provides a 5,000-year-old framework for understanding life's patterns. 
                Unlike sun-sign astrology, it considers:
              </p>
              <ul className="space-y-3">
                {[
                  "Your exact birth constellation (Nakshatra)",
                  "Ascendant sign (Lagna) and its lord",
                  "Planetary periods (Dasha system)",
                  "Divisional charts for specialized insights"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <div className="bg-purple-400/20 rounded-full w-6 h-6 flex items-center justify-center mr-3">
                      <span className="text-purple-300 text-sm font-bold">{index + 1}</span>
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="py-16">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Vedic Astrology Explained
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Answers to common questions about this ancient science
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="mb-4 border-b border-white/10 last:border-0"
              >
                <button
                  className="flex justify-between items-center w-full py-6 text-left"
                  onClick={() => toggleFaq(index)}
                >
                  <span className="text-lg font-medium text-white">{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-purple-400 transition-transform duration-300 ${activeFaq === index ? 'rotate-180' : ''}`} 
                  />
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ${
                    activeFaq === index ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-gray-300">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 text-center">
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-12 border border-purple-400/30">
            <h3 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Ready to Discover Your Cosmo Path?
            </h3>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Unlock personalized Vedic insights that illuminate your life's purpose, relationships, and destiny
            </p>
            <button
              onClick={onSignUp}
              className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Begin Your Journey
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Star className="text-purple-400 w-6 h-6" />
                <span className="text-white font-bold text-xl">Cosmo Vedic</span>
              </div>
              <p className="text-gray-400 mb-4">
                Illuminating life paths through ancient Vedic wisdom and modern technology
              </p>
              <div className="flex space-x-4">
                <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12z"/>
                  </svg>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10 5.523 0 10-4.477 10-10 0-5.523-4.477-10-10-10zm-2 15v-4H7v-4h3V8.012C10 6.904 10.895 6 12.006 6H15v4h-2v1h2v4h-3v4h-2z"/>
                  </svg>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Vedic Knowledge Base</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Planetary Guide</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Mantra Library</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Nakshatra Encyclopedia</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Services</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Birth Chart Analysis</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Compatibility Reading</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Dasha Period Forecast</a></li>
                <li><a href="#" className="text-gray-400 hover:text-purple-300 transition-colors">Remedial Solutions</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-3">
                <li className="text-gray-400">support@Cosmovedic.com</li>
                <li className="text-gray-400">+1 (800) 555-1080</li>
                <li className="text-gray-400">Varanasi, India</li>
                <li className="mt-4">
                  <button 
                    onClick={onSignIn}
                    className="text-purple-400 hover:text-white transition-colors flex items-center"
                  >
                    Contact Support <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="text-center text-gray-400 mt-12 pt-8 border-t border-white/10">
            <p>&copy; 2025.</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes shootingStar {
          0% {
            opacity: 0;
            transform: translateX(0) translateY(0);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(100vw) translateY(100vh);
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;