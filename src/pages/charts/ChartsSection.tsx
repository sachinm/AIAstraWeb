import React, { useEffect, useState } from "react";
import { Loader, Sparkles } from "lucide-react";
import { ShriGaneshAvatar } from "../../components/ShriGaneshAvatar";
import { fetchUserBiodata, BiodataResponse } from "../UserData";
import { streamDashboardSections } from "../../lib/pageTelemetry";
import LoadError from "../../components/LoadError";

const BiodataPage: React.FC = () => {
  const [data, setData] = useState<BiodataResponse | null>(null);
  const [streamUsername, setStreamUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const getData = async () => {
      try {
        setLoading(true);
        setError(null);
        let receivedBiodata: Record<string, string | number> | null = null;
        let resolvedUsername = "";

        try {
          await streamDashboardSections(
            ["profile", "biodata"],
            (chunk) => {
              if (!chunk.ok || !chunk.data) return;
              if (chunk.section === "profile") {
                const prof = chunk.data as { name?: string | null; username?: string | null };
                resolvedUsername = prof.name || prof.username || resolvedUsername;
                if (resolvedUsername) {
                  setStreamUsername(resolvedUsername);
                  setData((prev) => (prev ? { ...prev, username: resolvedUsername } : prev));
                }
              } else if (chunk.section === "biodata") {
                const bio =
                  typeof chunk.data === "string"
                    ? (JSON.parse(chunk.data) as Record<string, string | number>)
                    : (chunk.data as Record<string, string | number>);
                if (bio && typeof bio === "object" && Object.keys(bio).length > 0) {
                  receivedBiodata = bio;
                  setData({
                    success: true,
                    username: resolvedUsername || "Explorer",
                    biodata: bio,
                  });
                  setLoading(false);
                }
              }
            },
            controller.signal
          );
        } catch {
          /* fall back to GraphQL fetchUserBiodata below */
        }

        if (!receivedBiodata) {
          const biodata = await fetchUserBiodata();
          setData(biodata);
        } else if (resolvedUsername) {
          setData((prev) => (prev ? { ...prev, username: resolvedUsername } : prev));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void getData();
    return () => controller.abort();
  }, [attempt]);

  if (loading)
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader className="w-10 h-10 animate-spin text-yellow-400" />
        {streamUsername && (
          <p className="text-sm text-gray-300">
            Preparing {streamUsername}&apos;s astrological profile…
          </p>
        )}
      </div>
    );

  if (error)
    return (
      <LoadError detail={error} onRetry={() => setAttempt((a) => a + 1)} />
    );

  if (!data)
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-300">
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
          {data.username}'s AdAstra AI Biodata
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
            <div className="absolute -top-3 -left-3 shadow-md">
              <ShriGaneshAvatar
                className="h-9 w-9"
                ringClassName="ring-2 ring-purple-400/50 shadow-lg shadow-purple-900/40"
              />
            </div>
            <p className="text-sm text-gray-300 mb-1">{prettyLabels[key] || key}</p>
            <p className="text-lg font-semibold text-white">{String(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BiodataPage;
