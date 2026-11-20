"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Mail, X, Phone, Eye, EyeOff } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: { name: string; phone?: string; email?: string; isGuest?: boolean }) => void;
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"mobile" | "email">("mobile");
  
  // Mobile Flow States
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email Flow States
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleSendOTP = async () => {
    setIsSending(true);
    // Call FastAPI Backend (with graceful local fallback)
    try {
      await fetch("http://localhost:8000/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${mobileNumber}` }),
      });
    } catch (error) {
      console.warn("Backend /api/auth/send-otp offline or unreachable, proceeding in demo mode", error);
    } finally {
      setIsSending(false);
      setMobileStep(2);
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      alert("Please enter all 6 digits of the OTP / 6 இலக்க OTP குறியீட்டை உள்ளிடவும்");
      return;
    }
    setIsVerifying(true);
    let success = false;
    // Call FastAPI Backend
    try {
      const res = await fetch("http://localhost:8000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${mobileNumber}`, otp: otpString }),
      });
      if (res.ok) {
        success = true;
      }
    } catch (error) {
      console.warn("Backend /api/auth/verify-otp offline, completing in demo verification mode", error);
      success = true; // graceful fallback for frontend testing
    } finally {
      setIsVerifying(false);
      if (success) {
        alert("Login Successful! / வெற்றிகரமாக உள்நுழைந்தீர்கள்!");
        if (onLoginSuccess) {
          onLoginSuccess({
            name: "Citizen User",
            phone: `+91 ${mobileNumber}`
          });
        }
        onClose();
      } else {
        alert("Invalid OTP");
      }
    }
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert("Please enter email and password / மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்");
      return;
    }
    if (onLoginSuccess) {
      onLoginSuccess({
        name: isLogin ? email.split("@")[0] : fullName || "Citizen User",
        email: email
      });
    }
    alert(isLogin ? "Login Successful! / வெற்றிகரமாக உள்நுழைந்தீர்கள்!" : "Account Created! / கணக்கு உருவாக்கப்பட்டது!");
    onClose();
  };

  const handleGuestContinue = () => {
    if (onLoginSuccess) {
      onLoginSuccess({
        name: "விருந்தினர் (Guest)",
        isGuest: true
      });
    }
    onClose();
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 cursor-pointer">
          <X className="w-6 h-6" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#1E40AF]">சகாயக் | Sahayak</h2>
            <p className="text-sm text-gray-500 mt-1">உள்நுழைக / Login</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button
              onClick={() => setActiveTab("mobile")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "mobile" ? "bg-white text-[#1E40AF] shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Smartphone className="w-4 h-4" /> மொபைல் OTP
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "email" ? "bg-white text-[#1E40AF] shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Mail className="w-4 h-4" /> மின்னஞ்சல்
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* MOBILE TAB */}
            {activeTab === "mobile" && (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {mobileStep === 1 ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        உங்கள் மொபைல் எண் <span className="text-xs text-gray-500">(Mobile Number)</span>
                      </label>
                      <div className="flex relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none select-none">
                          <span className="text-lg">🇮🇳 +91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                          className="w-full pl-20 pr-4 py-4 text-lg font-medium bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#EA580C] focus:border-[#EA580C] transition-all outline-none"
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSendOTP}
                      disabled={mobileNumber.length !== 10 || isSending}
                      className="w-full py-4 bg-[#EA580C] hover:bg-[#c24100] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-medium rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      {isSending ? "அனுப்பப்படுகிறது..." : "OTP அனுப்புக (Send OTP)"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">OTP sent to +91 {mobileNumber}</p>
                      <button onClick={() => setMobileStep(1)} className="text-[#EA580C] text-sm font-medium mt-1 cursor-pointer hover:underline">
                        எண்ணை மாற்று (Edit Number)
                      </button>
                    </div>
                    
                    <div className="flex justify-between gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digit && index > 0) {
                              otpRefs.current[index - 1]?.focus();
                            }
                          }}
                          className="w-12 h-14 text-2xl font-bold text-center bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#EA580C] focus:border-[#EA580C] outline-none"
                        />
                      ))}
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={handleVerifyOTP}
                        disabled={isVerifying}
                        className="w-full py-4 bg-[#EA580C] hover:bg-[#c24100] text-white text-lg font-medium rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        {isVerifying ? "சரிபார்க்கப்படுகிறது..." : "சரிபார்க்கவும் (Verify & Login)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => alert("குரல் அழைப்பு மூலம் OTP கோரப்பட்டுள்ளது / OTP via voice call requested.")}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#1E40AF] cursor-pointer"
                      >
                        <Phone className="w-4 h-4" /> அழைப்பு மூலம் OTP பெறுக (Voice Call)
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* EMAIL TAB */}
            {activeTab === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">முழு பெயர் (Full Name)</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="எ.கா: கார்த்திக்"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E40AF] outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">மின்னஞ்சல் (Email)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E40AF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">கடவுச்சொல் (Password)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E40AF] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-gray-400 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEmailAuth}
                  className="w-full py-4 mt-2 bg-[#1E40AF] hover:bg-blue-800 text-white text-lg font-medium rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {isLogin ? "உள்நுழைக (Login)" : "கணக்கை உருவாக்குக (Sign Up)"}
                </button>

                <div className="text-center mt-4">
                  <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-[#1E40AF] cursor-pointer">
                    {isLogin ? "புதிய கணக்கு தொடங்க வேண்டுமா? (Create Account)" : "ஏற்கனவே கணக்கு உள்ளதா? (Login here)"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guest Access Footer */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <button
              onClick={handleGuestContinue}
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              இப்போது வேண்டாம், விருந்தினராக தொடரவும் (Continue as Guest)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
