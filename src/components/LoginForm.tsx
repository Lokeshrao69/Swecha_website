import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Phone, MessageSquare, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from "sonner";

interface LoginFormProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Keep only the first 10 digits
    return digits.slice(0, 10);
  };

  const getFullPhoneNumber = () => {
    return `+91${phoneDigits}`;
  };

  const isValidPhoneNumber = () => {
    return phoneDigits.length === 10;
  };

  const handleSendOTP = async () => {
    if (!isValidPhoneNumber()) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('https://backend2.swecha.org/api/v1/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: getFullPhoneNumber()
        }),
      });

      const data = await response.json();
      console.log('OTP Response:', data);
      
      if (response.ok) {
        setShowOtpInput(true);
        toast.success("OTP sent successfully!");
      } else {
        toast.error(data.message || data.detail || "Failed to send OTP");
      }
    } catch (error) {
      console.error('OTP Error:', error);
      toast.error("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      toast.error("Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://backend2.swecha.org/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: getFullPhoneNumber(),
          otp: otp
        }),
      });

      const data = await response.json();
      console.log('OTP Verify Response:', data);
      
      if (response.ok) {
        toast.success("Login successful!");
        onLoginSuccess(data.access_token, data.user || { phone: getFullPhoneNumber() });
      } else {
        toast.error(data.message || data.detail || "Invalid OTP");
      }
    } catch (error) {
      console.error('OTP Verify Error:', error);
      toast.error("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handlePasswordLogin = async () => {
    if (!isValidPhoneNumber() || !password) {
      toast.error("Please enter a valid phone number and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://backend2.swecha.org/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: getFullPhoneNumber(),
          password: password
        }),
      });

      const data = await response.json();
      console.log('Login Response:', data);
      
      if (response.ok) {
        toast.success("Login successful!");
        onLoginSuccess(data.access_token, data.user || { phone: getFullPhoneNumber() });
      } else {
        toast.error(data.message || data.detail || "Invalid credentials");
      }
    } catch (error) {
      console.error('Login Error:', error);
      toast.error("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <Card className="w-full max-w-md animate-scale-in relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-lg">
        <CardHeader className="text-center pb-8 pt-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl shadow-xl overflow-hidden">
  <img
    src="/favicon.png"
    alt="Logo"
    className="w-full h-full object-cover"
  />
</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </CardHeader>

        <CardContent className="space-y-6 px-8 pb-8">
          {/* Login Method Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <Button
              variant={loginMethod === 'otp' ? 'default' : 'ghost'}
              className={`flex-1 rounded-lg transition-all duration-300 ${
                loginMethod === 'otp' 
                  ? 'gradient-purple text-white shadow-lg' 
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              onClick={() => {
                setLoginMethod('otp');
                setShowOtpInput(false);
                setOtp('');
              }}
            >
              Login with OTP
            </Button>
            <Button
              variant={loginMethod === 'password' ? 'default' : 'ghost'}
              className={`flex-1 rounded-lg transition-all duration-300 ${
                loginMethod === 'password' 
                  ? 'gradient-purple text-white shadow-lg' 
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              onClick={() => setLoginMethod('password')}
            >
              Login with Password
            </Button>
          </div>

          {/* OTP Login Flow */}
          {loginMethod === 'otp' && !showOtpInput && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Enter your registered phone number to receive OTP
                </p>
              </div>
              
              <div className="relative">
                <Phone className="absolute left-4 top-4 h-5 w-5 text-purple-500" />
                <div className="absolute left-12 top-4 text-gray-500 font-medium">+91</div>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(formatPhoneNumber(e.target.value))}
                  className="pl-20 h-14 border-2 border-gray-200 focus:border-purple-500 rounded-xl text-lg bg-gray-50 focus:bg-white transition-all duration-300"
                />
                <div className="text-xs text-gray-500 mt-1 ml-1">
                  {phoneDigits.length}/10 digits
                </div>
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={loading || !isValidPhoneNumber()}
                className="w-full h-14 gradient-purple text-white hover:opacity-90 transition-all duration-300 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sending...
                  </div>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </div>
          )}

          {/* OTP Verification */}
          {loginMethod === 'otp' && showOtpInput && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  OTP sent to +91{phoneDigits}
                </p>
              </div>
              
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="h-14 border-2 border-gray-200 focus:border-purple-500 rounded-xl text-center text-2xl tracking-widest bg-gray-50 focus:bg-white transition-all duration-300"
                  maxLength={6}
                />
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading}
                  className="w-full h-14 gradient-purple text-white hover:opacity-90 transition-all duration-300 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Verifying...
                    </div>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowOtpInput(false);
                    setOtp('');
                  }}
                  className="w-full text-purple-600 hover:bg-purple-50 rounded-xl h-12 transition-all duration-300"
                >
                  Back to phone number
                </Button>
              </div>
            </div>
          )}

          {/* Password Login */}
          {loginMethod === 'password' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="relative">
                <Phone className="absolute left-4 top-4 h-5 w-5 text-purple-500 z-10" />
                <div className="absolute left-12 top-4 text-gray-500 font-medium">+91</div>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(formatPhoneNumber(e.target.value))}
                  className="pl-20 h-14 border-2 border-gray-200 focus:border-purple-500 rounded-xl text-lg bg-gray-50 focus:bg-white transition-all duration-300"
                />
                <div className="text-xs text-gray-500 mt-1 ml-1">
                  {phoneDigits.length}/10 digits
                </div>
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12 h-14 border-2 border-gray-200 focus:border-purple-500 rounded-xl text-lg bg-gray-50 focus:bg-white transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 h-6 w-6 text-purple-500 hover:text-purple-700 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <Button
                onClick={handlePasswordLogin}
                disabled={loading || !isValidPhoneNumber()}
                className="w-full h-14 gradient-purple text-white hover:opacity-90 transition-all duration-300 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Logging in...
                  </div>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
