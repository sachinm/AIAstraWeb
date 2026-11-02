import { PRODUCT_NAME } from './lib/legal';
import { LANDING_FAQS } from './lib/landingFaqs';
import React, { useEffect, useState } from 'react';
import { Star, ChevronDown, BookOpen, Globe, Shield, Users, Check, Move3d } from 'lucide-react';

interface LandingPageProps {
  onSignUp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSignUp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const vedicPrinciples = [
    {
      title: "Karma & Dharma",
      description: "Vedic astrology reveals how your past actions (karma) shape your present and future, and helps you align with your life's purpose (dharma).",
      icon: <BookOpen className="w-6 h-6 text-purple-400" />
    },
    {
      title: "Cosmic Connection",
      description: "The positions of planets at your birth create a unique energetic blueprint that influences your personality, relationships, and life path.",
      icon: <Globe className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Harmonize Your Actions",
      description: "Learn how planet placements, dasha systems and your yearly charts work together, so your actions move with the planetary energies that drive you.",
      icon: <Shield className="w-6 h-6 text-yellow-400" />
    },
    {
      title: "Cycles of Time",
      description: "Through dashas (planetary periods), Vedic astrology studies the timing of the chapters of a life.",
      icon: <Users className="w-6 h-6 text-pink-400" />
    }
  ];

  const faqs = LANDING_FAQS;

  return (
    <div className="min-h-full text-white relative overflow-hidden bg-gradient-to-b from-gray-900 via-indigo-900 to-gray-900">
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

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className={`text-center mb-20 transition-all duration-1000 delay-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}>
          <div className="inline-block mb-6 bg-purple-900/30 px-4 py-2 rounded-full border border-purple-400/30 animate-pulse">
            <span className="flex items-center text-purple-300">
              <Move3d className="mr-2 w-5 h-5" /> Vedic astrology with AI
            </span>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Discover Your Cosmic Blueprint
          </h1>
          <h3 className="text-5xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Through Vedic Wisdom
          </h3>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Explore Jyotish (Vedic astrology) through your own birth chart. Ask questions and read about what the tradition
            sees in your chart, for education and entertainment.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onSignUp}
              className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Generate My Chart
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('vedic-principles')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-10 py-4 text-white text-lg border border-purple-400/50 rounded-full hover:bg-purple-400/20 transition-all duration-300">
              Explore Vedic Wisdom
            </button>
          </div>
        </div>

        {/* Vedic Principles */}
        <div id="vedic-principles" className={`py-16 transition-all duration-1000 delay-700 ${
          isVisible ? 'opacity-100' : 'opacity-0 translate-y-10'
        }`}>
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              The Pillars of Vedic Astrology
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Jyotish, the "science of light," offers a comprehensive framework for understanding life's patterns 
              through cosmic influences
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
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-purple-900/70 to-gray-900" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              The Ancient Science of Light
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mb-8">
              Vedic astrology (Jyotish) is a long-standing tradition that relates cosmic patterns
              to human life
            </p>
            <button 
              onClick={onSignUp}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
            >
              Explore Your Cosmic Design
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
          
          <div className="max-w-2xl mx-auto mb-20">
            <div
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-500 transform ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
              style={{ transitionDelay: '1000ms' }}
            >
              <div className="mb-4">
                <Star className="w-8 h-8 text-pink-400" />
              </div>
              <h4 className="text-xl font-semibold mb-3 text-white">
                Birth Chart Analysis and AI Astrologer
              </h4>
              <p className="text-gray-300 leading-relaxed">
                Your Rasi chart, Navamsa and planetary positions, computed from your birth details. Ask AI Astra about your chart whenever you like.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="py-16">
          <div className={`text-center transition-all duration-1000 delay-1000 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h3 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Explore Your Life Through Cosmic Wisdom
            </h3>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Vedic astrology has much to say about dharma, relationships, career, and the spiritual path.{' '}
              {PRODUCT_NAME} brings that tradition and modern AI together in readings based on your own chart.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
              <h4 className="text-2xl font-semibold mb-4 text-white">Vedic Astrology vs Modern Life</h4>
              <ul className="space-y-4">
                {[
                  "Read about compatibility through Graha Maitri (planetary friendships)",
                  "Explore what Arudha Lagna says about how others see you",
                  "Learn how Muhurta approaches the timing of events"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-8 border border-purple-400/30">
              <h4 className="text-2xl font-semibold mb-4 text-white">What the Tradition Looks At</h4>
              <p className="text-gray-300 mb-6">
                Unlike sun-sign astrology, Vedic astrology considers:
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
              Ready to Explore Your Cosmic Path?
            </h3>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Create your chart and start asking questions
            </p>
            <button
              onClick={onSignUp}
              className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Begin Your Journey
            </button>
          </div>
        </div>
      </div>

      <style>{`
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