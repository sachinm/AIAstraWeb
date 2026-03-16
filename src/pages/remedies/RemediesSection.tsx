import React, { useState, useEffect } from 'react';
import { Heart, Gem, Flame, Droplets, Leaf, Sun, Moon, Star } from 'lucide-react';
import { fetchUserContent } from '../UserData';

interface User {
  name: string;
  dateOfBirth: string;
}

interface RemediesSectionProps {
  user: User;
}

const RemediesSection: React.FC<RemediesSectionProps> = ({ user }) => {
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-white text-lg">Loading remedies data...</div>
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

  // Extract data from API response
  const remedies = apiData.content?.remedies?.remedies;
  const gemstones = remedies?.gemstones || [];
  const rituals = remedies?.rituals || [];
  const donations = remedies?.donations || [];
  const personalPlan = remedies?.personalPlan || {};
  
  // Get planet icon based on planet name
  const getPlanetIcon = (planet: string) => {
    switch (planet.toLowerCase()) {
      case 'sun':
        return <Sun className="w-6 h-6 text-yellow-400" />;
      case 'moon':
        return <Moon className="w-6 h-6 text-blue-400" />;
      case 'mercury':
        return <Star className="w-6 h-6 text-green-400" />;
      case 'venus':
        return <Star className="w-6 h-6 text-pink-400" />;
      case 'mars':
        return <Flame className="w-6 h-6 text-red-400" />;
      case 'jupiter':
        return <Star className="w-6 h-6 text-purple-400" />;
      case 'saturn':
        return <Star className="w-6 h-6 text-indigo-400" />;
      case 'rahu':
        return <Star className="w-6 h-6 text-gray-400" />;
      case 'ketu':
        return <Star className="w-6 h-6 text-white" />;
      default:
        return <Star className="w-6 h-6 text-white" />;
    }
  };

  // Get color based on planet
  const getPlanetColor = (planet: string) => {
    switch (planet.toLowerCase()) {
      case 'sun':
        return 'yellow';
      case 'moon':
        return 'blue';
      case 'mercury':
        return 'green';
      case 'venus':
        return 'pink';
      case 'mars':
        return 'red';
      case 'jupiter':
        return 'purple';
      case 'saturn':
        return 'indigo';
      case 'rahu':
        return 'gray';
      case 'ketu':
        return 'white';
      default:
        return 'white';
    }
  };

  // Get ritual icon based on name
  const getRitualIcon = (name: string) => {
    if (name.toLowerCase().includes('surya') || name.toLowerCase().includes('sun')) {
      return <Sun className="w-6 h-6 text-yellow-400" />;
    } else if (name.toLowerCase().includes('chandra') || name.toLowerCase().includes('moon')) {
      return <Moon className="w-6 h-6 text-blue-400" />;
    } else if (name.toLowerCase().includes('shani') || name.toLowerCase().includes('saturn')) {
      return <Star className="w-6 h-6 text-indigo-400" />;
    } else if (name.toLowerCase().includes('rahu')) {
      return <Star className="w-6 h-6 text-gray-400" />;
    } else if (name.toLowerCase().includes('ketu')) {
      return <Star className="w-6 h-6 text-white" />;
    } else if (name.toLowerCase().includes('mars') || name.toLowerCase().includes('mangal')) {
      return <Flame className="w-6 h-6 text-red-400" />;
    } else if (name.toLowerCase().includes('venus') || name.toLowerCase().includes('shukra')) {
      return <Star className="w-6 h-6 text-pink-400" />;
    } else if (name.toLowerCase().includes('mercury') || name.toLowerCase().includes('budh')) {
      return <Star className="w-6 h-6 text-green-400" />;
    } else {
      return <Heart className="w-6 h-6 text-purple-400" />;
    }
  };

  // Get color for donation items based on purpose
  const getDonationColor = (purpose: string) => {
    if (purpose.toLowerCase().includes('sun') || purpose.toLowerCase().includes('mars')) {
      return 'red';
    } else if (purpose.toLowerCase().includes('moon') || purpose.toLowerCase().includes('ketu')) {
      return 'white';
    } else if (purpose.toLowerCase().includes('mercury')) {
      return 'green';
    } else if (purpose.toLowerCase().includes('venus')) {
      return 'pink';
    } else if (purpose.toLowerCase().includes('saturn') || purpose.toLowerCase().includes('rahu')) {
      return 'black';
    } else {
      return 'purple';
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          Vedic Remedies
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Harmonize your planetary influences through time-tested Vedic remedies including 
          gemstones, rituals, and charitable acts aligned with cosmic energies.
        </p>
      </div>

      {/* Gemstone Recommendations */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
          <Gem className="w-6 h-6 text-purple-400 mr-2" />
          Recommended Gemstones
        </h2>
        <div className="grid lg:grid-cols-3 gap-6">
          {gemstones.map((gem: any, index: number) => {
            const color = getPlanetColor(gem.planet);
            return (
              <div
                key={index}
                className={`bg-gradient-to-br from-${color}-900/20 to-${color}-800/10 rounded-lg p-6 border border-${color}-400/20 hover:border-${color}-400/40 transition-all duration-300`}
              >
                <div className="flex items-center mb-4">
                  <div className={`p-3 bg-${color}-500/20 rounded-full text-${color}-400 mr-4`}>
                    {getPlanetIcon(gem.planet)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{gem.gemstone}</h3>
                    <p className={`text-${color}-400 text-sm`}>For {gem.planet}</p>
                  </div>
                </div>
                
                <p className="text-gray-300 mb-4 text-sm">{gem.caution}</p>
                
                <div className="space-y-3">
                  <div className={`bg-${color}-500/10 rounded p-3`}>
                    <p className={`text-${color}-300 text-sm`}>
                      <strong>When to wear:</strong> {gem.wearingTime}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ritual Practices */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
          <Heart className="w-6 h-6 text-pink-400 mr-2" />
          Sacred Rituals
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {rituals.map((ritual: any, index: number) => (
            <div
              key={index}
              className="bg-white/5 rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              <div className="flex items-center mb-4">
                {getRitualIcon(ritual.name)}
                <h3 className="text-lg font-semibold text-white ml-3">{ritual.name}</h3>
              </div>
              
              <p className="text-gray-300 mb-4 text-sm">{ritual.purpose}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Frequency:</span>
                  <span className="text-white">{ritual.frequency}</span>
                </div>
                <div className="mt-3">
                  <span className="text-gray-400 block mb-1">Procedure:</span>
                  <span className="text-white text-xs">{ritual.procedure}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charitable Acts */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
          <Heart className="w-6 h-6 text-green-400 mr-2" />
          Charitable Donations (Daan)
        </h2>
        <p className="text-gray-300 mb-6">
          Perform these charitable acts to reduce negative planetary influences and generate positive karma.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {donations.map((donation: any, index: number) => {
            const color = getDonationColor(donation.purpose);
            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors duration-300"
              >
                <div>
                  <h4 className="text-white font-medium">{donation.item}</h4>
                  <p className="text-gray-400 text-sm">{donation.purpose}</p>
                </div>
                <div className="text-right">
                  <p className={`text-${color}-400 font-medium`}>{donation.quantity}</p>
                  <p className="text-gray-500 text-xs">Quantity</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Recommendation */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-6 border border-purple-400/20">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center">
          <Star className="w-6 h-6 text-purple-400 mr-2" />
          Your Personal Remedy Plan
        </h2>
        <p className="text-gray-300 mb-6">
          Based on your birth details, here's your personalized remedy schedule:
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Daily Routine */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-purple-300">Daily Routine</h3>
            <ul className="space-y-2 text-gray-300">
              {personalPlan.dailyRoutine && personalPlan.dailyRoutine.map((item: string, index: number) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Health Advice */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-purple-300">Health Advice</h3>
            <ul className="space-y-2 text-gray-300">
              {personalPlan.healthAdvice && personalPlan.healthAdvice.map((item: string, index: number) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Career Advice */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-purple-300">Career Advice</h3>
            <ul className="space-y-2 text-gray-300">
              {personalPlan.careerAdvice && personalPlan.careerAdvice.map((item: string, index: number) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Spiritual Practice */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-purple-300">Spiritual Practice</h3>
            <ul className="space-y-2 text-gray-300">
              {personalPlan.spiritualPractice && personalPlan.spiritualPractice.map((item: string, index: number) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Relationships Advice */}
          <div className="space-y-4 md:col-span-2">
            <h3 className="text-lg font-semibold text-purple-300">Relationships Advice</h3>
            <ul className="space-y-2 text-gray-300">
              {personalPlan.relationshipsAdvice && personalPlan.relationshipsAdvice.map((item: string, index: number) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-pink-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemediesSection;