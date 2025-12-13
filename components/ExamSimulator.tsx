
import React, { useState, useEffect, useRef } from 'react';
import { ExamSession, Question, Subject } from '../types';
import { Timer, ChevronLeft, ChevronRight, CheckSquare, Flag, Calculator as CalcIcon, X, Delete, GraduationCap, Grid, Maximize, Minimize, AlertCircle, Keyboard, MousePointer2, Moon, Sun, BarChart, Move } from 'lucide-react';
import { Button } from './Button';
import { User } from '../services/auth';
import { JambLogo, WaecLogo, AcenexaLogo } from './ExamLogos';

interface Props {
  session: ExamSession;
  onSubmit: (finalSession: ExamSession) => void;
  user: User;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ExamSimulator: React.FC<Props> = ({ session: initialSession, onSubmit, user, theme, toggleTheme }) => {
  const [session, setSession] = useState<ExamSession>(initialSession);
  const [currentSubject, setCurrentSubject] = useState<Subject>(session.subjects[0]);
  const [currentQIndex, setCurrentQIndex] = useState(0); 
  const [showInstructions, setShowInstructions] = useState(true);

  const [timeLeft, setTimeLeft] = useState(initialSession.durationSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMobileGrid, setShowMobileGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  
  const [isNavigating, setIsNavigating] = useState(false);

  // Calculator Dragging State
  const [calcPos, setCalcPos] = useState({ x: 0, y: 0 });
  const [isDraggingCalc, setIsDraggingCalc] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const currentQIndexRef = useRef(currentQIndex);
  const currentSubjectRef = useRef(currentSubject);
  const timeLeftRef = useRef(timeLeft);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Sync state if prop changes (Double safety alongside key prop)
  useEffect(() => {
      setSession(initialSession);
      setCurrentSubject(initialSession.subjects[0]);
      setTimeLeft(initialSession.durationSeconds);
      setCurrentQIndex(0);
      setShowInstructions(true);
  }, [initialSession]);

  useEffect(() => {
    currentQIndexRef.current = currentQIndex;
    currentSubjectRef.current = currentSubject;
  }, [currentQIndex, currentSubject]);

  useEffect(() => {
      timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-subject="${currentSubject}"]`) as HTMLElement;
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentSubject]);

  useEffect(() => {
    if (showInstructions) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showInstructions]);

  useEffect(() => {
      const saveProgress = () => {
          if (showInstructions) return;
          try {
              localStorage.setItem('jamb_cbt_progress', JSON.stringify({ 
                  session, 
                  savedTimeLeft: timeLeftRef.current 
              }));
          } catch (e) {
              console.error("Auto-save failed", e);
          }
      };
      const interval = setInterval(saveProgress, 15000);
      return () => clearInterval(interval);
  }, [session, showInstructions]); 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showInstructions) return;

      const key = e.key.toUpperCase();
      const qs = session.questions[currentSubjectRef.current] || [];
      if (qs.length === 0) return;
      const currentQ = qs[currentQIndexRef.current];
      
      if (['A', 'B', 'C', 'D'].includes(key)) {
        handleAnswer(currentQ.id, key as any);
      } else if (key === 'N') {
        navigate(1);
      } else if (key === 'P') {
        navigate(-1);
      } else if (key === 'S') {
        setShowSubmitModal(true);
      } else if (key === 'R') {
        toggleReview(currentQ.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, isNavigating, showInstructions]); 

  useEffect(() => {
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Handle Dragging Events for Calculator
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingCalc) return;
      e.preventDefault(); // Prevent scrolling on mobile while dragging
      
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      
      setCalcPos({ x: startPos.current.x + dx, y: startPos.current.y + dy });
    };

    const handleUp = () => {
      setIsDraggingCalc(false);
    };

    if (isDraggingCalc) {
      window.addEventListener('mousemove', handleMove, { passive: false });
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingCalc]);

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      setIsDraggingCalc(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      dragStart.current = { x: clientX, y: clientY };
      startPos.current = { ...calcPos };
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  const handleStartExam = () => {
      setSession(prev => ({
          ...prev,
          startTime: Date.now()
      }));
      setShowInstructions(false);
  };

  const getCurrentQuestions = () => session.questions[currentSubject] || [];
  const getCurrentQuestion = () => getCurrentQuestions()[currentQIndex];

  const handleAnswer = (qId: string, option: 'A' | 'B' | 'C' | 'D') => {
    setSession(prev => ({
      ...prev,
      answers: { ...prev.answers, [qId]: option }
    }));
  };

  const toggleReview = (qId: string) => {
    setSession(prev => {
      const isMarked = prev.markedForReview.includes(qId);
      return {
        ...prev,
        markedForReview: isMarked 
          ? prev.markedForReview.filter(id => id !== qId)
          : [...prev.markedForReview, qId]
      };
    });
  };

  const navigate = (dir: number) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    setTimeout(() => setIsNavigating(false), 300);

    const max = getCurrentQuestions().length - 1;
    let newIndex = currentQIndex + dir;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > max) newIndex = max;
    setCurrentQIndex(newIndex);
  };

  const handleSubmit = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
    }
    onSubmit({ ...session, isSubmitted: true });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCalcPress = (val: string) => {
    if (val === 'C') {
        setCalcInput('');
    } else if (val === 'DEL') {
        setCalcInput(prev => prev.slice(0, -1));
    } else if (val === '=') {
        try {
            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + calcInput)();
            setCalcInput(String(result));
        } catch {
            setCalcInput('Error');
        }
    } else {
        setCalcInput(prev => {
            if (prev === 'Error') return val;
            return prev + val;
        });
    }
  };

  const getExamLogo = () => {
      if (session.examType === 'JAMB') return <JambLogo className="w-8 h-8 md:w-10 md:h-10" />;
      if (session.examType === 'WAEC') return <WaecLogo className="w-8 h-8 md:w-10 md:h-10" />;
      return <AcenexaLogo className="w-6 h-6 md:w-8 md:h-8"/>;
  };

  // Progress Calculation
  const totalQuestions = Object.values(session.questions).flat().length;
  const answeredCount = Object.keys(session.answers).length;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const q = getCurrentQuestion();
  
  const renderQuestionGrid = () => (
    <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
      {getCurrentQuestions().map((_, idx) => {
        const qAtIdx = getCurrentQuestions()[idx];
        if (!qAtIdx) return null;
        
        const isAnswered = !!session.answers[qAtIdx.id];
        const isCurrent = idx === currentQIndex;
        const isMarked = session.markedForReview.includes(qAtIdx.id);
        
        let bgClass = "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400";
        if (isAnswered) bgClass = "bg-green-500 text-white border-green-600";
        if (isMarked) bgClass = "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-red-300 dark:border-red-800";
        if (isAnswered && isMarked) bgClass = "bg-purple-500 text-white border-purple-600";
        if (isCurrent) bgClass = "bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-800 border-blue-700 z-10 scale-110";
        
        return (
          <button
            key={idx}
            onClick={() => {
                if (!isNavigating) {
                    setCurrentQIndex(idx);
                    setShowMobileGrid(false);
                }
            }}
            disabled={isNavigating}
            className={`h-10 md:h-9 rounded font-bold text-sm md:text-xs transition-all border shadow-sm ${bgClass} ${isNavigating ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100 dark:bg-gray-900 select-none relative transition-colors duration-300 overflow-hidden">
      
      {/* INSTRUCTIONS MODAL */}
      {showInstructions && (
          <div className="fixed inset-0 bg-green-900/95 z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 max-w-2xl w-full rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-green-800 dark:bg-green-900 p-4 md:p-6 text-white text-center border-b-4 border-yellow-500 shrink-0">
                      <div className="mx-auto mb-2 w-fit bg-white rounded-full p-1">
                        {getExamLogo()}
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wide">{session.examType} Instructions</h2>
                      <p className="text-green-200 text-xs md:text-sm">Please read carefully before proceeding</p>
                  </div>
                  
                  <div className="p-4 md:p-8 space-y-4 md:space-y-6 overflow-y-auto custom-scroll">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                              <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2 text-sm md:text-base"><AlertCircle size={18} className="text-green-600 dark:text-green-400"/> Exam Rules</h3>
                              <ul className="text-xs md:text-sm text-gray-600 dark:text-gray-300 space-y-2 list-disc pl-4">
                                  <li>Do not refresh the page during the exam.</li>
                                  <li>Answer all compulsory questions.</li>
                                  <li>The timer starts immediately after you click 'Start'.</li>
                                  <li>Click <strong>Submit</strong> only when you are completely finished.</li>
                              </ul>
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                              <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2 text-sm md:text-base"><Keyboard size={18} className="text-green-600 dark:text-green-400"/> Keyboard Shortcuts</h3>
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-700 dark:text-gray-300">
                                  <div className="flex justify-between border-b dark:border-gray-600 pb-1"><span>A, B, C, D</span> <span className="text-gray-500 dark:text-gray-400">Select Option</span></div>
                                  <div className="flex justify-between border-b dark:border-gray-600 pb-1"><span>N</span> <span className="text-gray-500 dark:text-gray-400">Next Question</span></div>
                                  <div className="flex justify-between border-b dark:border-gray-600 pb-1"><span>P</span> <span className="text-gray-500 dark:text-gray-400">Prev Question</span></div>
                                  <div className="flex justify-between border-b dark:border-gray-600 pb-1"><span>S</span> <span className="text-gray-500 dark:text-gray-400">Submit Exam</span></div>
                                  <div className="flex justify-between"><span>R</span> <span className="text-gray-500 dark:text-gray-400">Mark Review</span></div>
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-200 dark:border-yellow-800">
                          <div>
                              <p className="text-[10px] text-yellow-800 dark:text-yellow-400 font-bold uppercase">Duration</p>
                              <p className="text-base md:text-lg font-bold text-gray-800 dark:text-white">{Math.floor(session.durationSeconds / 60)} Minutes</p>
                          </div>
                          <div>
                              <p className="text-[10px] text-yellow-800 dark:text-yellow-400 font-bold uppercase">Total Questions</p>
                              <p className="text-base md:text-lg font-bold text-gray-800 dark:text-white">{totalQuestions} Questions</p>
                          </div>
                      </div>

                      <Button onClick={handleStartExam} className="w-full py-3 md:py-4 text-base md:text-lg bg-green-700 hover:bg-green-800 text-white shadow-lg border-green-800 shrink-0 mb-4 md:mb-0">
                          <MousePointer2 className="inline mr-2" size={20}/> Start {session.examType} Exam
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-2 md:px-4 py-2 flex justify-between items-center shadow-sm border-t-4 border-yellow-500 z-20 transition-colors relative shrink-0">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <div className="flex items-center gap-2 md:border-r border-gray-200 dark:border-gray-700 md:pr-4 md:mr-2 shrink-0">
             {getExamLogo()}
             <span className="font-bold text-green-900 dark:text-green-300 tracking-tight hidden md:inline">ACENEXA</span>
          </div>
          
          <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-bold border-2 border-green-200 dark:border-green-800 shrink-0">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          
          <div className="hidden sm:block overflow-hidden max-w-[100px] md:max-w-none">
            <h2 className="font-bold text-xs md:text-sm text-gray-800 dark:text-white uppercase leading-tight truncate">{user.fullName}</h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">{user.regNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          
          <div className="hidden lg:flex items-center gap-2 mr-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
             <BarChart size={16} className="text-green-600 dark:text-green-400"/>
             <div className="flex flex-col">
                <span className="text-[8px] uppercase font-bold text-gray-400">Progress</span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 leading-none">{answeredCount} / {totalQuestions}</span>
             </div>
          </div>

          <Button
            onClick={toggleTheme}
            variant="outline"
            size="sm"
            className="px-2 py-2 md:px-3 md:py-1.5 items-center justify-center border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            title={theme === 'light' ? "Dark Mode" : "Light Mode"}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-yellow-400"/>}
          </Button>

          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="sm"
            className="hidden md:flex px-2 py-1.5 md:px-3 md:py-1.5 items-center justify-center border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </Button>

          <Button 
            onClick={() => setShowCalculator(!showCalculator)}
            variant="outline"
            size="sm"
            className={`px-2 py-2 md:px-3 md:py-1.5 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${showCalculator ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''}`}
            title="Calculator"
          >
            <CalcIcon size={18} />
          </Button>

          <Button
            onClick={() => setShowMobileGrid(true)}
            variant="outline"
            size="sm"
            className="md:hidden px-2 py-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <Grid size={18} />
          </Button>

          <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-700 px-2 py-1 md:px-3 rounded border border-gray-200 dark:border-gray-600 min-w-[60px] md:min-w-[100px]">
            <span className="text-[8px] md:text-[10px] text-gray-400 dark:text-gray-400 uppercase font-bold tracking-wider hidden sm:inline">Time Remaining</span>
            <div className={`text-sm md:text-xl font-mono font-bold leading-none ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-green-700 dark:text-green-400'}`}>
              <Timer className="hidden md:inline w-3 h-3 sm:w-4 sm:h-4 mb-0.5 mr-1 text-gray-400 dark:text-gray-500" />
              {formatTime(timeLeft)}
            </div>
          </div>
          <Button 
            onClick={() => setShowSubmitModal(true)} 
            variant="danger" 
            size="sm"
            className="rounded px-3 py-2 md:px-6 md:py-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm text-xs md:text-sm"
          >
            Submit
          </Button>
        </div>

        {/* PROGRESS BAR BOTTOM OVERLAY */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700">
            <div 
                className="h-full bg-green-500 transition-all duration-300 ease-out relative group"
                style={{ width: `${progressPercent}%` }}
            >
            </div>
        </div>
      </header>

      {/* CALCULATOR (Draggable) */}
      {showCalculator && (
        <div 
            className="fixed z-50 w-72 md:w-64 bg-gray-800 rounded-xl shadow-2xl border border-gray-600 overflow-hidden"
            style={{ 
                top: '50%', 
                left: '50%', 
                transform: `translate(calc(-50% + ${calcPos.x}px), calc(-50% + ${calcPos.y}px))` 
            }}
        >
            <div 
                className="bg-gray-900 p-2 flex justify-between items-center cursor-move touch-none"
                onMouseDown={onDragStart}
                onTouchStart={onDragStart}
            >
                <div className="flex items-center gap-2">
                    <Move size={14} className="text-gray-500"/>
                    <span className="text-xs font-bold text-gray-400 select-none">CALCULATOR</span>
                </div>
                <button onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-white p-1"><X size={14}/></button>
            </div>
            <div className="p-4">
                <div className="bg-green-100 h-10 mb-3 rounded text-right px-2 flex items-center justify-end font-mono text-xl overflow-hidden shadow-inner text-gray-900">
                    {calcInput || '0'}
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {['C', '/', '*', 'DEL'].map(btn => (
                        <button key={btn} onClick={() => handleCalcPress(btn)} 
                            className={`h-10 rounded font-bold text-sm transition-colors ${btn === 'C' || btn === 'DEL' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}>
                            {btn === 'DEL' ? <Delete size={14} className="mx-auto"/> : btn}
                        </button>
                    ))}
                    {['7', '8', '9', '-'].map(btn => (
                        <button key={btn} onClick={() => handleCalcPress(btn)} 
                            className={`h-10 rounded font-bold text-lg transition-colors ${btn === '-' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                            {btn}
                        </button>
                    ))}
                    {['4', '5', '6', '+'].map(btn => (
                        <button key={btn} onClick={() => handleCalcPress(btn)} 
                            className={`h-10 rounded font-bold text-lg transition-colors ${btn === '+' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                            {btn}
                        </button>
                    ))}
                    {['1', '2', '3', '='].map(btn => (
                        <button key={btn} onClick={() => handleCalcPress(btn)} 
                            className={`h-10 rounded font-bold text-lg transition-colors ${btn === '=' ? 'bg-green-600 hover:bg-green-700 text-white row-span-2 h-full' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                            style={btn === '=' ? { gridRow: 'span 2' } : {}}
                        >
                            {btn}
                        </button>
                    ))}
                    {['0', '.'].map(btn => (
                        <button key={btn} onClick={() => handleCalcPress(btn)} 
                            className={`h-10 rounded font-bold text-lg transition-colors bg-gray-700 hover:bg-gray-600 text-white ${btn === '0' ? 'col-span-2' : ''}`}>
                            {btn}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showMobileGrid && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden flex justify-end">
            <div className="w-4/5 max-w-sm bg-white dark:bg-gray-800 h-full shadow-2xl p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                    <h3 className="font-bold text-green-900 dark:text-green-400">{currentSubject} Grid</h3>
                    <button onClick={() => setShowMobileGrid(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                        <X size={20} className="text-gray-600 dark:text-gray-300"/>
                    </button>
                </div>
                {renderQuestionGrid()}
                
                <div className="mt-8 px-2 border-t dark:border-gray-700 pt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Key</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded border border-green-600"></div> Answered</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded"></div> Unanswered</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded"></div> Current</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded"></div> Flagged</div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* SUBJECT TABS */}
      <div 
        ref={tabsRef}
        className="bg-green-800 dark:bg-green-900 px-2 md:px-4 pt-2 flex gap-1 overflow-x-auto whitespace-nowrap custom-scroll shrink-0"
      >
        {session.subjects.map(sub => (
          <button
            key={sub}
            data-subject={sub}
            onClick={() => { setCurrentSubject(sub); setCurrentQIndex(0); }}
            className={`
              px-4 md:px-6 py-2 md:py-2.5 rounded-t-lg font-bold text-xs md:text-sm transition-colors flex-shrink-0 border-t-2
              ${currentSubject === sub 
                ? 'bg-white dark:bg-gray-800 text-green-900 dark:text-green-400 border-yellow-500 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] z-10' 
                : 'bg-green-900/50 dark:bg-gray-800/50 text-green-300 border-transparent hover:bg-green-700 dark:hover:bg-gray-700 hover:text-white'}
            `}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT: Question Panel */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-white dark:bg-gray-800 m-0 md:m-2 rounded-none md:rounded shadow-sm border-0 md:border border-gray-200 dark:border-gray-700 flex flex-col">
          {q ? (
            <>
                <div className="flex flex-col sm:flex-row justify-between mb-4 border-b dark:border-gray-700 pb-2 gap-2 shrink-0">
                    <span className="font-bold text-green-800 dark:text-green-400 text-base md:text-lg">Question {currentQIndex + 1} of {getCurrentQuestions().length}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">{session.examType}</span>
                        <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px] md:text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded w-fit">ID: {q.id.split('-')[0]}...</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <p className="text-base md:text-lg text-gray-800 dark:text-gray-200 leading-relaxed mb-6 md:mb-8 font-medium font-serif">
                    {q.text}
                    </p>

                    <div className="space-y-3 pb-4">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => {
                        const optText = q[`option${opt}` as keyof Question];
                        const isSelected = session.answers[q.id] === opt;
                        
                        return (
                        <label 
                            key={opt}
                            className={`
                            flex items-start md:items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all active:scale-[0.99]
                            ${isSelected 
                                ? 'border-green-600 bg-green-50 dark:bg-green-900/20 shadow-md' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                            `}
                        >
                            <div className={`
                            w-7 h-7 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs md:text-sm shrink-0 transition-colors mt-0.5 md:mt-0
                            ${isSelected ? 'bg-green-600 border-green-600 text-white' : 'border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400'}
                            `}>
                            {isSelected ? <CheckSquare size={14} /> : opt}
                            </div>
                            <input 
                            type="radio" 
                            name="option" 
                            className="hidden" 
                            checked={isSelected}
                            onChange={() => handleAnswer(q.id, opt)}
                            />
                            <span className="text-gray-800 dark:text-gray-200 text-base md:text-lg font-serif pt-0.5 md:pt-0">{optText}</span>
                        </label>
                        );
                    })}
                    </div>
                </div>

                {/* ACTION BAR */}
                <div className="mt-2 md:mt-4 flex flex-col md:flex-row justify-between items-center pt-2 md:pt-4 border-t dark:border-gray-700 gap-3 md:gap-0 shrink-0 bg-white dark:bg-gray-800">
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button 
                            onClick={() => navigate(-1)} 
                            disabled={currentQIndex === 0 || isNavigating}
                            className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 text-sm md:text-base justify-center"
                        >
                            <ChevronLeft className="inline mr-1" size={18} /> Previous
                        </Button>
                        <Button 
                            onClick={() => navigate(1)}
                            disabled={currentQIndex === getCurrentQuestions().length - 1 || isNavigating} 
                            className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-2 bg-green-700 text-white rounded hover:bg-green-800 text-sm md:text-base justify-center"
                        >
                            Next <ChevronRight className="inline ml-1" size={18} />
                        </Button>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => toggleReview(q.id)}
                            className={`flex-1 md:flex-none px-4 py-3 md:py-2 rounded text-sm font-semibold border transition-colors flex items-center justify-center ${session.markedForReview.includes(q.id) ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                        >
                            <Flag className="inline mr-1" size={16} /> {session.markedForReview.includes(q.id) ? 'Unmark' : 'Mark Review'}
                        </button>
                    </div>
                </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
                <div className="max-w-md">
                    <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4"/>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Questions Available</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        There are no questions loaded for <strong>{currentSubject}</strong> in the <strong>{session.examType}</strong> database yet.
                    </p>
                    <p className="mt-4 text-sm text-gray-500">Please contact the admin to upload questions for this subject.</p>
                </div>
            </div>
          )}
        </div>

        {/* RIGHT: Grid Panel (Desktop Only) */}
        <div className="w-72 bg-gray-50 dark:bg-gray-900 p-2 border-l border-gray-200 dark:border-gray-700 overflow-y-auto custom-scroll hidden md:block">
           <div className="mb-4 text-center p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-sm mx-2 mt-2">
             <h3 className="font-bold text-green-800 dark:text-green-400 uppercase text-sm tracking-wide">{currentSubject}</h3>
             <p className="text-[10px] text-gray-400">Navigation Panel</p>
           </div>
           
           <div className="px-2">
             {renderQuestionGrid()}
           </div>

           <div className="mt-8 px-4 border-t dark:border-gray-700 pt-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Key</h4>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded border border-green-600"></div> Answered
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-white dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded"></div> Unanswered
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded"></div> Current
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded"></div> Flagged
                  </div>
              </div>
           </div>
        </div>
      </main>

      {/* CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-green-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-2xl border-t-4 border-red-600">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Submit Examination?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
              You are about to submit your exam. You will not be able to change any answers after this action.
              <br/><br/>
              <span className="font-bold text-gray-800 dark:text-white">Subjects attempted:</span> {session.subjects.length}
            </p>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setShowSubmitModal(false)} variant="outline" className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</Button>
              <Button onClick={handleSubmit} variant="danger" className="bg-red-600 text-white hover:bg-red-700 shadow-lg">Yes, Submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
