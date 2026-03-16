import React, { useEffect, useState } from "react";
import { Loader, Star, Moon, Sun, Sparkles } from "lucide-react";
import { fetchUserBiodata, BiodataResponse } from "../UserData";

const BiodataPage: React.FC = () => {
  const [data, setData] = useState<BiodataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getData = async () => {
      try {
        setLoading(true);
        const biodata = await fetchUserBiodata();
        setData(biodata);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    getData();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader className="w-10 h-10 animate-spin text-yellow-400" />
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-black text-red-300">
        <p className="text-lg font-medium">{error}</p>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-gray-400">
        <p>No biodata available</p>
      </div>
    );

  const prettyLabels: { [key: string]: string } = {
    date: "Date of Birth",
    time: "Time of Birth",
    place: "Place of Birth",
    yoga: "Yoga",
    tithi: "Tithi",
    karana: "Karana",
    sunset: "Sunset",
    sunrise: "Sunrise",
    altitude: "Altitude",
    ayanamsa: "Ayanamsa",
    horaLord: "Hora Lord",
    timeZone: "Time Zone",
    kaalaLord: "Kaala Lord",
    nakshatra: "Nakshatra",
    janmaGhatis: "Janma Ghatis",
    mahakalaHora: "Mahakala Hora",
    siderealTime: "Sidereal Time",
    vedicWeekday: "Vedic Weekday",
    lunarYearMonth: "Lunar Year & Month",
  };

  return (
    <div className="min-h-screen p-8 text-white">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4 animate-pulse">
          <Sparkles className="w-12 h-12 text-yellow-400" />
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          {data.username}'s Cosmic Biodata
        </h1>
        <p className="text-gray-300 mt-2">
          Astrological profile based on your birth details
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(data.biodata).map(([key, value]) => (
          <div
            key={key}
            className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20 shadow-lg hover:shadow-purple-500/20 transition duration-300"
          >
            <div className="absolute -top-3 -left-3 bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-full shadow-md">
              {key.includes("sun") ? (
                <Sun className="w-4 h-4 text-yellow-300" />
              ) : key.includes("moon") || key.includes("nakshatra") ? (
                <Moon className="w-4 h-4 text-blue-300" />
              ) : (
                <Star className="w-4 h-4 text-purple-300" />
              )}
            </div>
            <p className="text-sm text-gray-300 mb-1">{prettyLabels[key] || key}</p>
            <p className="text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BiodataPage;
