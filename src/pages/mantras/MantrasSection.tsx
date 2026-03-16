import React, { useState, useEffect } from 'react';
import { BookOpen, Play, Pause, Volume2, Star, Sun, Moon, Zap } from 'lucide-react';
import { fetchUserContent } from '../UserData';

interface User {
  name: string;
  dateOfBirth: string;
}

interface MantrasSectionProps {
  user: User;
}

const MantrasSection: React.FC<MantrasSectionProps> = ({ user }) => {
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [playingMantra, setPlayingMantra] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchUserContent();
        setApiData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="text-white text-lg">Loading mantras data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="text-red-400 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!apiData) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="text-white text-lg">No data available</div>
      </div>
    );
  }

  // Extract data from API response - correct path based on your API structure
  const mantrasData = apiData.content?.mantras?.mantras || [];
  const birthDetails = apiData.content?.birthDetails || {};

  // Get planet icon based on mantra content
  const getPlanetIcon = (mantraText: string) => {
    if (mantraText.includes('सूर्य') || mantraText.includes('Surya')) {
      return <Sun className="w-6 h-6 text-yellow-400" />;
    } else if (mantraText.includes('चंद्र') || mantraText.includes('Chandra')) {
      return <Moon className="w-6 h-6 text-blue-400" />;
    } else if (mantraText.includes('मङ्गल') || mantraText.includes('Mangal')) {
      return <Zap className="w-6 h-6 text-red-400" />;
    } else if (mantraText.includes('वासुदेव') || mantraText.includes('Venus')) {
      return <Star className="w-6 h-6 text-pink-400" />;
    } else if (mantraText.includes('बुध') || mantraText.includes('Mercury')) {
      return <Star className="w-6 h-6 text-green-400" />;
    } else if (mantraText.includes('गुरु') || mantraText.includes('Jupiter')) {
      return <Star className="w-6 h-6 text-purple-400" />;
    } else if (mantraText.includes('शनि') || mantraText.includes('Saturn')) {
      return <Star className="w-6 h-6 text-indigo-400" />;
    } else if (mantraText.includes('रौहिणी') || mantraText.includes('Rahu')) {
      return <Star className="w-6 h-6 text-gray-400" />;
    } else if (mantraText.includes('केतु') || mantraText.includes('Ketu')) {
      return <Star className="w-6 h-6 text-white" />;
    } else if (mantraText.includes('शिव') || mantraText.includes('Shiva')) {
      return <Zap className="w-6 h-6 text-purple-400" />;
    } else {
      return <Star className="w-6 h-6 text-white" />;
    }
  };

  // Get color based on planet
  const getPlanetColor = (mantraText: string) => {
    if (mantraText.includes('सूर्य') || mantraText.includes('Surya')) {
      return 'yellow';
    } else if (mantraText.includes('चंद्र') || mantraText.includes('Chandra')) {
      return 'blue';
    } else if (mantraText.includes('मङ्गल') || mantraText.includes('Mangal')) {
      return 'red';
    } else if (mantraText.includes('वासुदेव') || mantraText.includes('Venus')) {
      return 'pink';
    } else if (mantraText.includes('बुध') || mantraText.includes('Mercury')) {
      return 'green';
    } else if (mantraText.includes('गुरु') || mantraText.includes('Jupiter')) {
      return 'purple';
    } else if (mantraText.includes('शनि') || mantraText.includes('Saturn')) {
      return 'indigo';
    } else if (mantraText.includes('रौहिणी') || mantraText.includes('Rahu')) {
      return 'gray';
    } else if (mantraText.includes('केतु') || mantraText.includes('Ketu')) {
      return 'white';
    } else if (mantraText.includes('शिव') || mantraText.includes('Shiva')) {
      return 'purple';
    } else {
      return 'blue';
    }
  };

  // Get planet name from mantra
  const getPlanetName = (mantraText: string) => {
    if (mantraText.includes('सूर्य') || mantraText.includes('Surya')) {
      return 'Sun';
    } else if (mantraText.includes('चंद्र') || mantraText.includes('Chandra')) {
      return 'Moon';
    } else if (mantraText.includes('मङ्गल') || mantraText.includes('Mangal')) {
      return 'Mars';
    } else if (mantraText.includes('वासुदेव') || mantraText.includes('Venus')) {
      return 'Venus';
    } else if (mantraText.includes('बुध') || mantraText.includes('Mercury')) {
      return 'Mercury';
    } else if (mantraText.includes('गुरु') || mantraText.includes('Jupiter')) {
      return 'Jupiter';
    } else if (mantraText.includes('शनि') || mantraText.includes('Saturn')) {
      return 'Saturn';
    } else if (mantraText.includes('रौहिणी') || mantraText.includes('Rahu')) {
      return 'Rahu';
    } else if (mantraText.includes('केतु') || mantraText.includes('Ketu')) {
      return 'Ketu';
    } else if (mantraText.includes('शिव') || mantraText.includes('Shiva')) {
      return 'Shiva';
    } else {
      return 'Universal';
    }
  };

  const toggleMantraPlay = (mantraId: string) => {
    if (playingMantra === mantraId) {
      setPlayingMantra(null);
    } else {
      setPlayingMantra(mantraId);
    }
  };

  // Generate horoscope based on API data
  const generateHoroscope = () => {
    const nakshatra = birthDetails.nakshatra || '';
    const weekday = birthDetails.vedicWeekday || '';
    const yoga = birthDetails.yoga || '';
    
    return {
      daily: {
        date: new Date().toLocaleDateString(),
        prediction: nakshatra ? `Today's energy is influenced by your ${nakshatra} nakshatra and ${yoga} yoga. ${weekday} is a favorable day for spiritual practices. Focus on activities that align with your planetary strengths.` : 'Focus on spiritual practices and meditation today.',
        luckyNumber: Math.floor(Math.random() * 9) + 1,
        luckyColor: 'Purple',
        luckyTime: '10:00 AM - 12:00 PM'
      },
      weekly: nakshatra ? `This week emphasizes spiritual growth influenced by your ${nakshatra} nakshatra. Your ruling planets are in favorable positions, bringing harmony to relationships.` : 'This week brings opportunities for spiritual growth and inner transformation.',
      monthly: nakshatra ? `This month brings significant spiritual progress influenced by your ${nakshatra} nakshatra. The alignment of planets suggests enhanced intuition.` : 'This month focuses on spiritual development and connection with divine energies.'
    };
  };

  const horoscope = generateHoroscope();

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          Sacred Mantras 
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Connect with divine energies through powerful Vedic mantras and receive 
          personalized cosmic guidance for your spiritual journey.
        </p>
      </div>



      {/* Sacred Mantras */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
          <BookOpen className="w-6 h-6 text-purple-400 mr-2" />
          Personalized Mantras for You
        </h2>
        {mantrasData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No mantras data available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {mantrasData.map((mantra: any, index: number) => {
              const color = getPlanetColor(mantra.mantra);
              const planetName = getPlanetName(mantra.mantra);
              
              return (
                <div
                  key={index}
                  className={`bg-gradient-to-r from-${color}-900/10 to-${color}-800/5 rounded-lg p-6 border border-${color}-400/20`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`p-2 bg-${color}-500/20 rounded-full text-${color}-400 mr-4`}>
                        {getPlanetIcon(mantra.mantra)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{planetName} Mantra</h3>
                        <p className={`text-${color}-400 text-sm`}>For {planetName}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleMantraPlay(`mantra-${index}`)}
                      className={`p-3 bg-${color}-500/20 rounded-full text-${color}-400 hover:bg-${color}-500/30 transition-colors duration-300`}
                    >
                      {playingMantra === `mantra-${index}` ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Sanskrit Text */}
                  <div className="mb-4 p-4 bg-white/5 rounded-lg">
                    <p className="text-center text-xl text-white font-medium mb-2" style={{ fontFamily: 'serif' }}>
                      {mantra.mantra}
                    </p>
                  </div>

                  {/* Meaning */}
                  <div className="mb-4">
                    <h4 className="text-white font-semibold mb-2">Meaning:</h4>
                    <p className="text-gray-300 leading-relaxed">{mantra.meaning}</p>
                  </div>

                  {/* Benefits and Instructions */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-semibold mb-2">Benefits:</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{mantra.benefits}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Repetitions:</span>
                        <span className="text-white font-medium">{mantra.repetitions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Best Time:</span>
                        <span className="text-white font-medium text-sm">{mantra.best_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Player Simulation */}
                  {playingMantra === `mantra-${index}` && (
                    <div className={`mt-4 p-3 bg-${color}-500/10 rounded-lg flex items-center space-x-3`}>
                      <Volume2 className={`w-5 h-5 text-${color}-400`} />
                      <div className="flex-1">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className={`bg-${color}-500 h-2 rounded-full w-1/3`}></div>
                        </div>
                      </div>
                      <span className={`text-${color}-300 text-sm`}>Playing...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extended Horoscope */}
     

      {/* Personalized Practice */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-6 border border-purple-400/20">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center">
          <BookOpen className="w-6 h-6 text-purple-400 mr-2" />
          Your Daily Mantra Practice
        </h2>
        <p className="text-gray-300 mb-6">
          Based on your birth chart, here's your personalized daily mantra practice:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <h4 className="text-yellow-300 font-semibold mb-2">Morning (5:00-7:00 AM)</h4>
            <p className="text-gray-300 text-sm">Sun, Mars, Mercury Mantras</p>
            <p className="text-gray-400 text-xs mt-1">108 times each</p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <h4 className="text-blue-300 font-semibold mb-2">Evening (7:00-9:00 PM)</h4>
            <p className="text-gray-300 text-sm">Moon, Venus, Jupiter Mantras</p>
            <p className="text-gray-400 text-xs mt-1">108 times each</p>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <h4 className="text-purple-300 font-semibold mb-2">As Needed</h4>
            <p className="text-gray-300 text-sm">Saturn, Rahu, Ketu, Shiva Mantras</p>
            <p className="text-gray-400 text-xs mt-1">Based on planetary transits</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MantrasSection;