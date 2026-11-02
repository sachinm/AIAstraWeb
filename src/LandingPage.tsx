import { useTranslation } from 'react-i18next';
import RegionSwitch from './components/RegionSwitch';
import { useRegion } from './lib/region';
import Disclaimer from './components/Disclaimer';
import { PRODUCT_NAME, SUPPORT_EMAIL } from './lib/legal';
import { LANDING_FAQS } from './lib/landingFaqs';
import React, { useEffect, useState } from 'react';
import { Star, Moon, Sun, Sparkles, ChevronDown, BookOpen, Globe, Shield, Users, ArrowRight, Check, Move3d } from 'lucide-react';

interface LandingPageProps {
  onPricing?: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp, onPricing }) => {
  const { t } = useTranslation();
  const [region, setRegion] = useRegion();
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
      title: "Remedial Solutions",
      description: "The tradition offers remedies such as mantras, gemstones, and rituals for working with planetary energies.",
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
    <div className="min-h-screen text-white relative overflow-hidden bg-gradient-to-b from-gray-900 via-indigo-900 to-gray-900">
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
              {PRODUCT_NAME}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <RegionSwitch value={region} onChange={setRegion} />
            {onPricing && (
              <button type="button" onClick={onPricing} className="text-gray-200 hover:text-white">
                {t('region.pricing')}
              </button>
            )}
            <button type="button" onClick={onSignIn} className="text-gray-200 hover:text-white">
              Sign in
            </button>
            <button
              onClick={onSignUp}
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
              <Move3d className="mr-2 w-5 h-5" /> Vedic astrology with AI
            </span>
          </div>
          <h2 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Discover Your Cosmic Blueprint
          </h2>
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
                description: "What the tradition suggests for your chart: gemstones, rituals, and spiritual practices."
              },
              {
                icon: <Sparkles className="w-8 h-8 text-purple-400" />,
                title: "Mantra & Meditation",
                description: "Traditional mantras and meditation techniques related to your chart."
              },
              {
                icon: <Star className="w-8 h-8 text-pink-400" />,
                title: "AI Astrologer",
                description: "Ask an AI about your chart whenever you like."
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
              Explore Your Life Through Cosmic Wisdom
            </h3>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Vedic astrology has much to say about dharma, relationships, career, and the spiritual path.
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
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Star className="text-purple-400 w-6 h-6" />
                <span className="text-white font-bold text-xl">{PRODUCT_NAME}</span>
              </div>
              <p className="text-gray-400 mb-4">
                Vedic astrology and modern AI, for education and entertainment
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                <li><button type="button" onClick={onSignUp} className="text-gray-400 hover:text-purple-300 transition-colors">Create an account</button></li>
                <li><button type="button" onClick={onSignIn} className="text-gray-400 hover:text-purple-300 transition-colors">Sign in</button></li>
                {onPricing && <li><button type="button" onClick={onPricing} className="text-gray-400 hover:text-purple-300 transition-colors">Pricing</button></li>}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="/terms" className="text-gray-400 hover:text-purple-300 transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="text-gray-400 hover:text-purple-300 transition-colors">Privacy Policy</a></li>
                <li><a href="/refunds" className="text-gray-400 hover:text-purple-300 transition-colors">Refund Policy</a></li>
              </ul>
            </div>

            {SUPPORT_EMAIL && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Contact</h4>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-gray-400 hover:text-purple-300 transition-colors">{SUPPORT_EMAIL}</a>
              </div>
            )}
          </div>

          <div className="text-center text-gray-400 mt-12 pt-8 border-t border-white/10">
            <Disclaimer className="mb-4" />
            <p>&copy; 2026 {PRODUCT_NAME}. All rights reserved.</p>
          </div>
        </div>
      </footer>

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