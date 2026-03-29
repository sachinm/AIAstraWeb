import React, { useState } from 'react';
import { Star, UserIcon, Mail, Lock, Calendar, MapPin, Clock, ArrowLeft } from 'lucide-react';
import type { User as AppUser } from '../App';
import { signup } from './api';
import { useRecaptcha } from './useRecaptcha';

interface SignUpProps {
  onSignUp: (userData: AppUser) => void;
  onSignIn: () => void;
  onBack: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp, onSignIn, onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    placeOfBirth: '',
    timeOfBirth: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: 'M' // Default gender value
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { getToken, isEnabled } = useRecaptcha();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.age || parseInt(formData.age) < 1 || parseInt(formData.age) > 120) {
      newErrors.age = 'Valid age is required';
    }
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.placeOfBirth.trim()) newErrors.placeOfBirth = 'Place of birth is required';
    if (!formData.timeOfBirth) newErrors.timeOfBirth = 'Time of birth is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: {[key: string]: string} = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Valid email is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);

    try {
      const recaptchaToken = isEnabled ? await getToken('signup') : null;
      if (isEnabled && !recaptchaToken) {
        setErrors({
          submit: 'Security check failed to load. Please refresh the page and try again.',
        });
        setIsLoading(false);
        return;
      }

      // Format data according to API requirements
      const apiData = {
        username: formData.name.replace(/\s+/g, '').toLowerCase(),
        password: formData.password,
        date_of_birth: formData.dateOfBirth,
        place_of_birth: formData.placeOfBirth,
        time_of_birth: formData.timeOfBirth + ':00',
        email: formData.email,
        gender: formData.gender,
        age: parseInt(formData.age),
        name: formData.name,
        recaptchaToken,
      };

      try {
        // Call the API
        const result = await signup(apiData);
        
        if (result.success) {
          // Successfully signed up
          const userData = {
            name: formData.name,
            email: formData.email,
            age: parseInt(formData.age),
            dateOfBirth: formData.dateOfBirth,
            placeOfBirth: formData.placeOfBirth,
            timeOfBirth: formData.timeOfBirth
          };
          
          // Store user data and auth state
          localStorage.setItem('astroUser', JSON.stringify(userData));
          localStorage.setItem('isAuthenticated', 'true');
          
          onSignUp(userData);
        } else {
          // Handle API error
          setErrors({ submit: result.message || 'Signup failed. Please try again.' });
        }
      } catch (apiError) {
        console.error("API error:", apiError);
        setErrors({ submit: 'An error occurred while signing up. Please try again.' });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={step === 1 ? onBack : () => setStep(1)}
          className="flex items-center text-purple-300 hover:text-white mb-8 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 1 ? 'Back to Home' : 'Previous Step'}
        </button>

        {/* Progress Indicator */}
        <div className="flex justify-between mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-purple-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 1 ? 'border-purple-400 bg-purple-400/20' : 'border-gray-500'
            }`}>
              1
            </div>
            <span className="ml-2 text-sm">Birth Details</span>
          </div>
          <div className={`flex items-center ${step >= 2 ? 'text-purple-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 2 ? 'border-purple-400 bg-purple-400/20' : 'border-gray-500'
            }`}>
              2
            </div>
            <span className="ml-2 text-sm">Account</span>
          </div>
        </div>

        {/* Sign Up Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Star className="w-12 h-12 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
            <p className="text-gray-300">
              {step === 1 ? 'Enter your birth details for personalized insights' : 'Complete your account setup'}
            </p>
          </div>

          {errors.submit && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
              {errors.submit}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); if (!isLoading) handleNext(); }} className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.name ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.name && <p className="text-red-300 text-sm mt-1">{errors.name}</p>}
              </div>

              {/* Age */}
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className={`w-full bg-white/10 border ${errors.age ? 'border-red-500' : 'border-white/20'} rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                  placeholder="Enter your age"
                  min="1"
                  max="120"
                />
                {errors.age && <p className="text-red-300 text-sm mt-1">{errors.age}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.dateOfBirth ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                  />
                </div>
                {errors.dateOfBirth && <p className="text-red-300 text-sm mt-1">{errors.dateOfBirth}</p>}
              </div>

              {/* Place of Birth */}
              <div>
                <label htmlFor="placeOfBirth" className="block text-sm font-medium text-gray-300 mb-2">
                  Place of Birth
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="placeOfBirth"
                    name="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.placeOfBirth ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                    placeholder="City, Country"
                  />
                </div>
                {errors.placeOfBirth && <p className="text-red-300 text-sm mt-1">{errors.placeOfBirth}</p>}
              </div>

              {/* Time of Birth */}
              <div>
                <label htmlFor="timeOfBirth" className="block text-sm font-medium text-gray-300 mb-2">
                  Time of Birth
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="time"
                    id="timeOfBirth"
                    name="timeOfBirth"
                    value={formData.timeOfBirth}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.timeOfBirth ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                  />
                </div>
                {errors.timeOfBirth && <p className="text-red-300 text-sm mt-1">{errors.timeOfBirth}</p>}
              </div>

              {/* Gender */}
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-2">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105"
              >
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.email ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                    placeholder="Enter your email"
                  />
                </div>
                {errors.email && <p className="text-red-300 text-sm mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.password ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                    placeholder="Create a password"
                  />
                </div>
                {errors.password && <p className="text-red-300 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full bg-white/10 border ${errors.confirmPassword ? 'border-red-500' : 'border-white/20'} rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300`}
                    placeholder="Confirm your password"
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-300 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  "Create Account"
                )}
              </button>

              {isEnabled && (
                <p className="text-center text-xs text-gray-500">
                  reCAPTCHA v3 runs invisibly on submit (no checkbox). This site is protected by reCAPTCHA and the Google{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Terms of Service
                  </a>{' '}
                  apply.
                </p>
              )}
            </form>
          )}

          {/* Sign In Link */}
          <div className="text-center mt-6">
            <p className="text-gray-300">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSignIn}
                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-300"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;