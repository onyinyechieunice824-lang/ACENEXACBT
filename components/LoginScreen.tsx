
import React, { useState } from 'react';
import { Button } from './Button';
import { User, loginUser, loginWithToken, verifyPaystackPayment } from '../services/auth';
import { BookOpen, AlertCircle, Lock, User as UserIcon, HelpCircle, ArrowLeft, GraduationCap, CheckCircle, Moon, Sun, Key, Smartphone, ShieldCheck, CreditCard, ChevronRight, Calendar, Hash, Banknote, Shield, MessageCircle, Copy, Building2, WifiOff, Check } from 'lucide-react';
import { ExamType } from '../types';
import { PAYSTACK_PUBLIC_KEY } from '../services/config';
import { JambLogo, WaecLogo, JointLogo, AcenexaLogo } from './ExamLogos';

interface Props {
  onLogin: (user: User, examType: ExamType) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isOnline: boolean;
}

type PackageType = 'JAMB' | 'WAEC' | 'BOTH';

interface PackageOption {
    id: PackageType;
    title: string;
    price: number;
}

const PACKAGES: PackageOption[] = [
    { id: 'JAMB', title: 'JAMB Only', price: 1500 },
    { id: 'WAEC', title: 'WAEC Only', price: 1500 },
    { id: 'BOTH', title: 'Full Access', price: 3000 },
];

export const LoginScreen: React.FC<Props> = ({ onLogin, theme, toggleTheme, isOnline }) => {
  const [mode, setMode] = useState<'token' | 'admin'>('token');
  const [view, setView] = useState<'login' | 'payment' | 'token_display'>('login');
  
  // Login Form State
  const [tokenInput, setTokenInput] = useState('');
  const [adminData, setAdminData] = useState({ username: '', password: '' });
  
  // Payment Form State
  const [purchaseData, setPurchaseData] = useState({
      fullName: '',
      phoneNumber: '',
      email: ''
  });
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('BOTH');
  const [paymentStep, setPaymentStep] = useState<'details' | 'gateway' | 'bank_transfer'>('details');
  
  const [purchasedToken, setPurchasedToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // Confirmation Modal State
  const [showBindConfirm, setShowBindConfirm] = useState(false);

  // --- HANDLERS ---

  const handleTokenLogin = async (e?: React.FormEvent, isConfirmation: boolean = false) => {
      if (e) e.preventDefault();
      setError('');
      setIsLoading(true);

      // UI Safety Valve: Force stop loading after 8 seconds if something hangs
      const safetyTimer = setTimeout(() => {
          if (isLoading) {
              setIsLoading(false);
              setError("Request timed out. Please check your connection or try again.");
          }
      }, 8000);

      try {
          const formattedToken = tokenInput.trim().toUpperCase();
          const user = await loginWithToken(formattedToken, isConfirmation);
          
          clearTimeout(safetyTimer); // Clear safety timer on success
          setShowBindConfirm(false); // Close modal if open

          let initialExamType: ExamType = 'JAMB';
          if (user.allowedExamType === 'WAEC') {
              initialExamType = 'WAEC';
          } 
          
          onLogin(user, initialExamType); 
      } catch (err: any) {
          clearTimeout(safetyTimer); // Clear safety timer on error
          
          if (err.message === 'BINDING_REQUIRED') {
              // Open Confirmation Modal
              setShowBindConfirm(true);
              setIsLoading(false);
              return;
          }

          setError(err.message || 'Invalid Token or Device Mismatch');
          setIsLoading(false);
      }
  };

  const handleConfirmBinding = () => {
      handleTokenLogin(undefined, true);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Small delay to allow UI to show loading state if instant
    setTimeout(async () => {
        try {
            const user = await loginUser(adminData.username, adminData.password, 'admin');
            onLogin(user, 'JAMB');
        } catch (err: any) {
            setError(err.message || 'Admin login failed');
            setIsLoading(false);
        }
    }, 100);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
      e.preventDefault();
      if (!purchaseData.fullName || !purchaseData.email || !purchaseData.phoneNumber) {
          setError("Please fill all fields");
          return;
      }
      setError('');
      setPaymentStep('gateway');
  };

  const getCurrentPrice = () => {
      return PACKAGES.find(p => p.id === selectedPackage)?.price || 3000;
  };

  const launchPaystack = () => {
      if (PAYSTACK_PUBLIC_KEY.includes('xxxx') || !PAYSTACK_PUBLIC_KEY.startsWith('pk_')) {
          alert("SETUP INCOMPLETE: Check config.");
          return;
      }

      if (!(window as any).PaystackPop) {
          setError("Paystack SDK not loaded. Check connection.");
          return;
      }

      const amountKobo = getCurrentPrice() * 100;

      const handler = (window as any).PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: purchaseData.email,
          amount: amountKobo, 
          currency: 'NGN',
          ref: 'PAY-' + Math.floor((Math.random() * 1000000000) + 1), 
          metadata: {
              custom_fields: [
                  { display_name: "Full Name", variable_name: "full_name", value: purchaseData.fullName },
                  { display_name: "Phone Number", variable_name: "phone_number", value: purchaseData.phoneNumber },
                  { display_name: "Exam Type", variable_name: "exam_type", value: selectedPackage }
              ]
          },
          callback: function(response: any) {
              verifyTransaction(response.reference);
          },
          onClose: function() {
              // alert('Transaction cancelled.');
          }
      });
      handler.openIframe();
  };

  const verifyTransaction = async (reference: string) => {
      setIsLoading(true);
      setProcessingMsg('Verifying Payment...');
      try {
          const res = await verifyPaystackPayment(
              reference,
              purchaseData.email,
              purchaseData.fullName,
              purchaseData.phoneNumber,
              selectedPackage,
              getCurrentPrice()
          );
          setPurchasedToken(res.token);
          setView('token_display');
          setPaymentStep('details');
      } catch (err: any) {
          setError(err.message || "Verification failed. Ref: " + reference);
      } finally {
          setIsLoading(false);
          setProcessingMsg('');
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          alert("Copied to clipboard!");
      });
  };

  const getPackageLogo = (id: PackageType) => {
      if (id === 'JAMB') return <JambLogo className="w-8 h-8 md:w-10 md:h-10 shrink-0" />;
      if (id === 'WAEC') return <WaecLogo className="w-8 h-8 md:w-10 md:h-10 shrink-0" />;
      return <JointLogo className="w-12 h-8 md:w-14 md:h-10 shrink-0" />;
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      
      {/* --- CONFIRMATION MODAL --- */}
      {showBindConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border-t-8 border-yellow-500 transform scale-100 transition-transform">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 text-center">
                      <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-yellow-200 dark:border-yellow-700">
                          <Shield size={32} className="text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase mb-2">Bind Device?</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                          You are about to lock this Access Code to <strong>this current device</strong>.
                      </p>
                  </div>
                  <div className="p-6 pt-2">
                       <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-6 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          WARNING: You will NOT be able to use this code on any other phone or computer after this.
                       </p>
                       <div className="flex flex-col gap-3">
                           <Button 
                                onClick={handleConfirmBinding} 
                                isLoading={isLoading}
                                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3"
                           >
                               Yes, Bind to this Device
                           </Button>
                           <Button 
                                onClick={() => { setShowBindConfirm(false); setIsLoading(false); }} 
                                variant="outline"
                                className="w-full border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                           >
                               Cancel
                           </Button>
                       </div>
                  </div>
              </div>
          </div>
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="bg-[#004d40] dark:bg-green-900 text-white py-6 px-4 shadow-xl border-b-4 border-yellow-500 relative">
            <button 
                onClick={toggleTheme} 
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-green-700/50 text-white transition-colors"
                title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-400"/>}
            </button>
            <div className="max-w-6xl mx-auto flex flex-col items-center justify-center text-center gap-3">
                <div className="bg-white p-2 rounded-full border-2 border-yellow-500 shadow-md">
                    <AcenexaLogo className="w-12 h-12 md:w-16 md:h-16" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-4xl font-black uppercase tracking-wide leading-tight drop-shadow-md text-white">ACENEXA CBT</h1>
                    <p className="text-yellow-400 text-xs md:text-sm font-bold uppercase tracking-[0.25em] mt-2 text-shadow-sm">Prepare Smart. Score Higher.</p>
                </div>
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md shadow-2xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all mt-4 relative">
                
                {/* --- CARD HEADER --- */}
                <div className="pt-8 pb-4 px-8 text-center relative min-h-[80px] flex items-center justify-center">
                    {view === 'login' && (
                        <>
                            <h2 
                                className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer select-none"
                            >
                                {mode === 'token' ? 'Candidate' : 'Admin Login'}
                            </h2>
                            <button 
                                onClick={() => setMode(mode === 'token' ? 'admin' : 'token')} 
                                className="absolute right-6 top-8 text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1"
                                title="Toggle Admin Mode"
                            >
                                <Lock size={16} />
                            </button>
                        </>
                    )}
                    
                    {view === 'token_display' && (
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-wider">
                            Success
                        </h2>
                    )}

                    {view === 'payment' && (
                        <div className="w-full relative flex items-center justify-center">
                            <button 
                                onClick={() => {
                                    if (paymentStep === 'gateway') setPaymentStep('details');
                                    else if (paymentStep === 'bank_transfer') setPaymentStep('gateway');
                                    else setView('login');
                                }}
                                className="absolute left-0 -ml-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                                title="Go Back"
                            >
                                <ArrowLeft size={24}/>
                            </button>
                            <div className="text-center">
                                <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-wider">
                                    {paymentStep === 'gateway' ? 'Checkout' : paymentStep === 'bank_transfer' ? 'Transfer Info' : 'Buy Access'}
                                </h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                    {paymentStep === 'gateway' ? 'Select Payment' : paymentStep === 'bank_transfer' ? 'Manual Payment' : 'Step 1 of 2'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 md:p-8 pt-0">
                    {/* --- ERROR DISPLAY --- */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs rounded flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span className="font-semibold">{error}</span>
                        </div>
                    )}

                    {/* --- VIEW: TOKEN LOGIN --- */}
                    {view === 'login' && mode === 'token' && (
                        <>
                            <div className="mb-6 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-600 dark:border-red-500 shadow-sm">
                                <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2 text-sm mb-2 uppercase">
                                    <Smartphone size={16}/> Security Alert
                                </h3>
                                <p className="text-xs text-red-700 dark:text-red-200 leading-relaxed font-medium">
                                    Your <strong>Access Code</strong> will be permanently bound to this device upon login. You will NOT be able to use it on any other phone or computer.
                                </p>
                            </div>

                            <form onSubmit={(e) => handleTokenLogin(e)} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Enter Access Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. ACE-ABCD-1234-WXYZ" 
                                        className="w-full p-4 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none transition-colors text-center font-mono text-lg uppercase tracking-widest" 
                                        value={tokenInput}
                                        onChange={e => setTokenInput(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <Button isLoading={isLoading && !showBindConfirm} className="w-full bg-[#004d40] hover:bg-green-800 text-white font-bold py-4 rounded uppercase text-sm tracking-wider shadow-md">
                                    Login & Lock to Device
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-gray-500 text-xs mb-2">Don't have an Access Code?</p>
                                <button 
                                    onClick={() => setView('payment')} 
                                    disabled={!isOnline}
                                    className={`text-sm font-bold text-green-700 dark:text-green-400 hover:underline flex items-center justify-center gap-1 mx-auto ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isOnline ? (
                                        <><CreditCard size={16}/> Purchase Access Now</>
                                    ) : (
                                        <><WifiOff size={16}/> Offline (Payments Disabled)</>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {/* --- VIEW: PAYMENT --- */}
                    {view === 'payment' && (
                        <div className="mt-2">
                            {paymentStep === 'details' ? (
                                <>
                                    <form onSubmit={handleProceedToPayment} className="space-y-4">
                                        <div className="mb-4">
                                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Select Package</h3>
                                            <div className="grid grid-cols-1 gap-2">
                                                {PACKAGES.map(pkg => (
                                                    <div 
                                                        key={pkg.id}
                                                        onClick={() => setSelectedPackage(pkg.id)}
                                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${selectedPackage === pkg.id ? 'border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-green-300'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {getPackageLogo(pkg.id)}
                                                            <p className={`font-bold text-sm ${selectedPackage === pkg.id ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>{pkg.title}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-black text-sm text-gray-800 dark:text-white">₦{pkg.price.toLocaleString()}</p>
                                                            {selectedPackage === pkg.id && <CheckCircle size={14} className="text-green-600"/>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded border-2 border-green-200 dark:border-green-800 text-center mb-4">
                                            <div className="flex items-center justify-center gap-2 mb-1 text-green-800 dark:text-green-300 font-bold uppercase text-sm">
                                                <GraduationCap size={18} />
                                                Includes JAMB & WAEC
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Full Name</label>
                                            <input 
                                                type="text"
                                                placeholder="e.g. John Doe"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 outline-none" 
                                                value={purchaseData.fullName}
                                                onChange={e => setPurchaseData({...purchaseData, fullName: e.target.value})}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Phone Number</label>
                                            <input 
                                                type="tel"
                                                placeholder="08012345678"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 outline-none" 
                                                value={purchaseData.phoneNumber}
                                                onChange={e => setPurchaseData({...purchaseData, phoneNumber: e.target.value})}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Email Address</label>
                                            <input 
                                                type="email"
                                                placeholder="you@example.com"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 outline-none" 
                                                value={purchaseData.email}
                                                onChange={e => setPurchaseData({...purchaseData, email: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <Button className="w-full bg-green-700 text-white py-3 flex items-center justify-center gap-2">
                                            Proceed to Pay ₦{getCurrentPrice().toLocaleString()} <ChevronRight size={16}/>
                                        </Button>
                                    </form>
                                </>
                            ) : paymentStep === 'gateway' ? (
                                <>
                                    <div className="space-y-6">
                                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 relative">
                                            <button 
                                                onClick={() => setPaymentStep('details')}
                                                className="absolute top-4 right-4 text-xs text-blue-600 hover:underline font-bold"
                                            >
                                                Edit
                                            </button>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-gray-500">Package:</span>
                                                <span className="font-bold text-green-700 dark:text-green-400 truncate max-w-[150px]">
                                                    {PACKAGES.find(p => p.id === selectedPackage)?.title}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-gray-500">Name:</span>
                                                <span className="font-bold text-gray-800 dark:text-white truncate max-w-[150px]">{purchaseData.fullName}</span>
                                            </div>
                                            <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                                                <span className="text-gray-500 font-bold">Total:</span>
                                                <span className="font-black text-green-700 dark:text-green-400 text-lg">₦{getCurrentPrice().toLocaleString()}.00</span>
                                            </div>
                                        </div>

                                        <div className="pt-0">
                                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Select Payment Method</h3>
                                            
                                            <div className="space-y-3">
                                                <button onClick={launchPaystack} className="w-full bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-gray-600 p-3 rounded-lg flex items-center justify-between group transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                                            <CreditCard className="text-green-600" size={20}/>
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-bold text-gray-800 dark:text-white group-hover:text-green-700 text-sm">Pay with Card / Bank</div>
                                                            <div className="text-[10px] text-gray-500">Secured by Paystack</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="text-gray-300 group-hover:text-green-500" size={18}/>
                                                </button>
                                                
                                                <button onClick={() => setPaymentStep('bank_transfer')} className="w-full bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600 p-3 rounded-lg flex items-center justify-between group transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <Banknote className="text-blue-600" size={20}/>
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-bold text-gray-800 dark:text-white group-hover:text-blue-700 text-sm">Bank Transfer</div>
                                                            <div className="text-[10px] text-gray-500">Manual Verification</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="text-gray-300 group-hover:text-blue-500" size={18}/>
                                                </button>
                                            </div>
                                            
                                            {isLoading && (
                                                <div className="text-center py-4">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto mb-2"></div>
                                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{processingMsg}</p>
                                                </div>
                                            )}

                                            <div className="mt-6 flex justify-center">
                                                <button 
                                                    onClick={() => setPaymentStep('details')}
                                                    className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    <ArrowLeft size={14}/> Back to Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 text-center shadow-sm">
                                            <h3 className="text-sm font-black text-blue-800 dark:text-blue-300 uppercase mb-6 tracking-widest border-b border-blue-200 dark:border-blue-700 pb-2">
                                                Bank Transfer Details
                                            </h3>
                                            
                                            <div className="space-y-5 mb-6">
                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bank Name</p>
                                                    <p className="text-xl font-bold text-gray-800 dark:text-white flex items-center justify-center gap-2">
                                                        <Building2 size={18} className="text-blue-600"/> GTB
                                                    </p>
                                                </div>
                                                
                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Number</p>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <p className="text-3xl font-mono font-black text-gray-800 dark:text-white tracking-widest select-all">0221414586</p>
                                                        <button onClick={() => copyToClipboard("0221414586")} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-gray-700"><Copy size={16}/></button>
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Name</p>
                                                    <p className="text-base font-bold text-gray-800 dark:text-white">Agua Ebubechukwu Samuel</p>
                                                </div>

                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Amount to Transfer</p>
                                                    <p className="text-xl font-black text-green-600 dark:text-green-400">₦{getCurrentPrice().toLocaleString()}.00</p>
                                                </div>
                                            </div>

                                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                                <p className="text-xs text-green-800 dark:text-green-300 font-bold mb-2">After payment, send proof to:</p>
                                                <a href="https://wa.me/2349086950567" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors shadow-sm">
                                                    <MessageCircle size={18} /> WhatsApp: 09086950567
                                                </a>
                                                <p className="text-[10px] text-green-700 dark:text-green-400 mt-2 leading-tight">For enquiry, complaint and payment dispute</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-center">
                                            <button 
                                                onClick={() => setPaymentStep('gateway')}
                                                className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold uppercase tracking-widest transition-colors"
                                            >
                                                <ArrowLeft size={14}/> Back to Payment Methods
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* --- VIEW: TOKEN DISPLAY (POST PAYMENT) --- */}
                    {view === 'token_display' && (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <CheckCircle size={32}/>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Payment Successful!</h2>
                            <p className="text-sm text-gray-500 mb-6">Here is your full access code.</p>
                            
                            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 mb-6">
                                <p className="font-mono text-2xl font-bold text-green-800 dark:text-green-400 tracking-wider break-all select-all">
                                    {purchasedToken}
                                </p>
                            </div>
                            
                            <Button onClick={() => { setTokenInput(purchasedToken); setView('login'); setMode('token'); }} className="w-full bg-green-700 text-white">
                                Proceed to Login
                            </Button>
                        </div>
                    )}

                    {/* --- VIEW: ADMIN LOGIN --- */}
                    {view === 'login' && mode === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-5">
                            <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Admin Username</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none" 
                                value={adminData.username}
                                onChange={e => setAdminData({...adminData, username: e.target.value})}
                                required
                            />
                            </div>
                            <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Admin Password</label>
                            <input 
                                type="password" 
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none" 
                                value={adminData.password}
                                onChange={e => setAdminData({...adminData, password: e.target.value})}
                                required
                            />
                            </div>
                            <Button isLoading={isLoading} className="w-full bg-[#004d40] text-white font-bold py-3 rounded uppercase text-sm">
                                Enter Admin Panel
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
        
        <footer className="bg-green-950/80 backdrop-blur-sm border-t border-green-800 py-4 text-center text-xs text-green-100/70 font-medium">
            &copy; {new Date().getFullYear()} ACENEXA CBT. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
};
