"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Mail, X, Phone, Eye, EyeOff } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

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
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isEmailVerifying, setIsEmailVerifying] = useState(false);
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleSendOTP = async () => {
    setIsSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${mobileNumber}` }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || "Unable to send SMS OTP.");
        setIsSending(false);
        return;
      }
    } catch {
      alert("Unable to reach backend auth service.");
      setIsSending(false);
      return;
    }
    setIsSending(false);
    setMobileStep(2);
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      alert("Please enter all 6 digits of the OTP / 6 இலக்க OTP குறியீட்டை உள்ளிடவும்");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${mobileNumber}`, otp: otpString }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phone_verified) {
        localStorage.setItem("msg_user_phone", `+91${mobileNumber}`);
        localStorage.setItem("msg_phone_verified", "true");
        // Check if email already verified
        const savedEmail = localStorage.getItem("msg_user_email");
        if (savedEmail && localStorage.getItem("msg_email_verified") === "true") {
          try {
            const sessRes = await fetch(`${API_BASE}/api/auth/verified-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone_number: `+91${mobileNumber}`, email: savedEmail }),
            });
            const sData = await sessRes.json().catch(() => ({}));
            if (sData.token) localStorage.setItem("msg_applicant_token", sData.token);
          } catch { /* proceed */ }
        }
        alert("Mobile verified! / மொபைல் எண் வெற்றிகரமாக சரிபார்க்கப்பட்டது!");
        if (onLoginSuccess) {
          onLoginSuccess({
            name: "Citizen Applicant",
            phone: `+91 ${mobileNumber}`
          });
        }
        onClose();
      } else {
        alert(data.detail || "Invalid or expired OTP");
      }
    } catch {
      alert("Connection error during OTP verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendEmailOTP = async () => {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address");
      return;
    }
    setIsEmailSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.detail || "Unable to send email OTP. Disposable emails are blocked.");
        setIsEmailSending(false);
        return;
      }
      setEmailStep(2);
    } catch {
      alert("Unable to reach backend auth service.");
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    const code = emailOtp.join("");
    if (code.length !== 6) {
      alert("Please enter the 6-digit email OTP");
      return;
    }
    setIsEmailVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.email_verified) {
        localStorage.setItem("msg_user_email", email);
        localStorage.setItem("msg_email_verified", "true");
        const savedPhone = localStorage.getItem("msg_user_phone");
        if (savedPhone && localStorage.getItem("msg_phone_verified") === "true") {
          try {
            const sessRes = await fetch(`${API_BASE}/api/auth/verified-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone_number: savedPhone, email }),
            });
            const sData = await sessRes.json().catch(() => ({}));
            if (sData.token) localStorage.setItem("msg_applicant_token", sData.token);
          } catch { /* proceed */ }
        }
        alert("Email verified successfully! / மின்னஞ்சல் சரிபார்க்கப்பட்டது!");
        if (onLoginSuccess) {
          onLoginSuccess({
            name: email.split("@")[0],
            email
          });
        }
        onClose();
      } else {
        alert(data.detail || "Invalid or expired OTP");
      }
    } catch {
      alert("Connection error during verification.");
    } finally {
      setIsEmailVerifying(false);
    }
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
                {emailStep === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        மின்னஞ்சல் முகவரி (Email Address)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="citizen@example.gov.in"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E40AF] outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Government scheme applications require verified official or personal email (disposable emails blocked).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendEmailOTP}
                      disabled={!email || !email.includes("@") || isEmailSending}
                      className="w-full py-4 bg-[#1E40AF] hover:bg-blue-800 disabled:bg-gray-300 text-white text-lg font-medium rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      {isEmailSending ? "அனுப்பப்படுகிறது..." : "OTP அனுப்புக (Send Email OTP)"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">OTP sent to {email}</p>
                      <button
                        onClick={() => setEmailStep(1)}
                        className="text-[#1E40AF] text-sm font-medium mt-1 cursor-pointer hover:underline"
                      >
                        மின்னஞ்சலை மாற்று (Edit Email)
                      </button>
                    </div>

                    <div className="flex justify-between gap-2">
                      {emailOtp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { emailOtpRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            const newOtp = [...emailOtp];
                            newOtp[index] = val;
                            setEmailOtp(newOtp);
                            if (val && index < 5) emailOtpRefs.current[index + 1]?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digit && index > 0) {
                              emailOtpRefs.current[index - 1]?.focus();
                            }
                          }}
                          className="w-12 h-14 text-2xl font-bold text-center bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E40AF] outline-none"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyEmailOTP}
                      disabled={isEmailVerifying || emailOtp.some((d) => !d)}
                      className="w-full py-4 bg-[#1E40AF] hover:bg-blue-800 disabled:bg-gray-300 text-white text-lg font-medium rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      {isEmailVerifying ? "சரிபார்க்கப்படுகிறது..." : "சரிபார்க்கவும் (Verify Email)"}
                    </button>
                  </div>
                )}
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
