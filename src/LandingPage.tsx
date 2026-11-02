import { LANDING_FAQS } from './lib/landingFaqs';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import ConstellationSky from './components/ConstellationSky';

interface LandingPageProps {
  onSignUp: () => void;
}

const HEADING = 'text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent';
const PRIMARY_BUTTON =
  'px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-2xl';

/** The front page: what it is, what it holds, common questions. The sky behind it comes from AppFrame. */
const LandingPage: React.FC<LandingPageProps> = ({ onSignUp }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <div className="relative min-h-full text-white">
      <ConstellationSky />
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true" data-test-id="shooting-stars">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="shooting-star absolute w-1 h-1 bg-white rounded-full opacity-0"
            style={{ top: `${15 + i * 25}%`, left: '-5%', animationDuration: `${15 + i * 5}s`, animationDelay: `${i * 10}s` }}
          />
        ))}
      </div>
      <div className="relative max-w-3xl mx-auto px-6 py-20">
        {/* a soft dark pool behind the hero words, so they read over the star map */}
        <div className="text-center mb-20 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(11,10,31,0.8)_20%,rgba(11,10,31,0.35)_55%,transparent_75%)] px-4 py-10">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Discover Your Cosmic Blueprint
          </h1>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed">
            Explore Jyotish (Vedic astrology) through your own birth chart. Ask questions and read about what the tradition
            sees in your chart, for education and entertainment.
          </p>
          <button type="button" onClick={onSignUp} className={PRIMARY_BUTTON}>
            Generate My Chart
          </button>
        </div>

        <section
          aria-labelledby="chart-records"
          className="mb-20 bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20"
        >
          <h2 id="chart-records" className={HEADING}>
            About 9,500 records of astrological data for your chart
          </h2>
          <p className="text-lg text-gray-300 leading-relaxed">
            Your divisional charts, dasha systems, strengths, annual charts and transits come to about 9,500 records of
            astrological data, available for every chart. Each reading draws on the records that bear on your question.
          </p>
        </section>

        <section aria-labelledby="landing-faq" className="mb-20">
          <h2 id="landing-faq" className={HEADING}>
            Common questions
          </h2>
          {LANDING_FAQS.map((faq, index) => (
            <div key={faq.question} className="border-b border-white/10 last:border-0">
              <button
                type="button"
                aria-expanded={activeFaq === index}
                className="flex justify-between items-center w-full py-5 text-left"
                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
              >
                <span className="text-lg font-medium text-white">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 ml-4 flex-shrink-0 text-purple-400 transition-transform duration-300 ${activeFaq === index ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  activeFaq === index ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-gray-300">{faq.answer}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="text-center">
          <button type="button" onClick={onSignUp} className={PRIMARY_BUTTON}>
            Generate My Chart
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
