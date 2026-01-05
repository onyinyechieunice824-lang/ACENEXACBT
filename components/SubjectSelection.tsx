
import React, { useState, useEffect } from 'react';
import { Subject, ExamResult, ExamType, SubjectInfo } from '../types';
import { CheckCircle, PlayCircle, LogOut, User as UserIcon, History, Calendar, Key, X, GraduationCap, Eye, ChevronDown, Moon, Sun, Layers, MousePointer2, Lock, Star, Calculator, PartyPopper, MessageSquare } from 'lucide-react';
import { Button } from './Button';
import { User, changePassword } from '../services/auth';
import { getStudentResults, getAllSubjects } from '../services/db';
import { ContactModal } from './ContactModal';
import { AcenexaLogo } from './ExamLogos';

interface Props {
  onStartExam: (subjects: Subject[]) => void;
  hasSavedSession: boolean;
  onResume: () => void;
  onLogout: () => void;
  onReview: (result: ExamResult) => void;
  user: User;
  examType: ExamType;
  setExamType: (type: ExamType) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const SubjectSelection: React.FC<Props> = ({ onStartExam, hasSavedSession, onResume, onLogout, onReview, user, examType, setExamType, theme, toggleTheme }) => {
  const [selected, setSelected] = useState<Subject[]>([]);
  const [history, setHistory] = useState<ExamResult[]>([]);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [pwdData, setPwdData] = useState({ old: '', new: '', confirm: '' });

  // Dynamic subjects
  const [allSubjects, setAllSubjects] = useState<SubjectInfo[]>([]);
  const [jambSubjects, setJambSubjects] = useState<Subject[]>([]);
  const [waecSubjects, setWaecSubjects] = useState<Record<string, Subject[]>>({});

  useEffect(() => {
    if (user.username) {
        // Fetch history async
        getStudentResults(user.username).then(res => setHistory(res)).catch(console.error);
    }

    // Fetch dynamic subjects
    getAllSubjects().then(subjects => {
        setAllSubjects(subjects);

        // Build JAMB subjects (flat list excluding English which is compulsory)
        const jamb = subjects.filter(s => !s.is_compulsory).map(s => s.name);
        setJambSubjects(jamb);

        // Build WAEC subjects (grouped by category)
        const waecGroups: Record<string, Subject[]> = {};
        subjects.forEach(s => {
            const categoryKey = s.category === 'General' ? 'General (Core)' : s.category;
            if (!waecGroups[categoryKey]) {
                waecGroups[categoryKey] = [];
            }
            waecGroups[categoryKey].push(s.name);
        });
        setWaecSubjects(waecGroups);
    }).catch(console.error);
  }, [user]);

  // Reset selection when exam type changes
  useEffect(() => {
      setSelected([]);
  }, [examType]);

  // Constraints
  const JAMB_ELECTIVES_COUNT = 3;
  const WAEC_SUBJECT_COUNT = 1; // Single subject exam

  const targetCount = examType === 'JAMB' ? JAMB_ELECTIVES_COUNT : WAEC_SUBJECT_COUNT;
  const isJamb = examType === 'JAMB';

  const toggleSubject = (sub: Subject) => {
    if (!isJamb) {
        // WAEC: Single Selection Mode (Select one, deselect others)
        if (selected.includes(sub)) {
            setSelected([]);
        } else {
            setSelected([sub]);
        }
        return;
    }

    // JAMB: Multi Selection Mode
    if (selected.includes(sub)) {
      setSelected(selected.filter(s => s !== sub));
    } else {
      if (selected.length < targetCount) {
        setSelected([...selected, sub]);
      }
    }
  };

  const isValid = selected.length === targetCount;

  const formatDate = (ts: number) => {
      return new Date(ts).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdData.new !== pwdData.confirm) return alert("New passwords do not match");
    try {
        await changePassword(user.username, pwdData.old, pwdData.new, 'student');
        alert("Password changed successfully!");
        setPwdData({ old: '', new: '', confirm: '' });
        setShowPwdModal(false);
    } catch (err: any) {
        alert(err.message);
    }
  };

  const renderSubjectButton = (sub: Subject) => (
    <button
        key={sub}
        onClick={() => toggleSubject(sub)}
        className={`
            p-3 md:p-4 rounded-lg border text-left text-xs md:text-sm transition-all relative font-medium active:scale-[0.98] flex items-center justify-between shadow-sm
            ${selected.includes(sub) 
            ? isJamb 
                ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-900 dark:text-green-100 ring-1 ring-green-500' 
                : 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }
        `}
    >
        <span className="truncate mr-2 font-semibold flex items-center gap-2">
            {sub}
        </span>
        {selected.includes(sub) && <CheckCircle size={16} className={isJamb ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"} />}
    </button>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-start md:justify-center p-0 md:p-4 transition-colors duration-300">
      
      <ContactModal 
        isOpen={showContact} 
        onClose={() => setShowContact(false)} 
        initialName={user.fullName}
      />

      <div className={`bg-white dark:bg-gray-800 w-full md:max-w-5xl md:rounded-xl shadow-2xl overflow-hidden mb-0 md:mb-8 relative border-t-8 transition-colors duration-500 flex flex-col h-full md:h-auto ${isJamb ? 'border-green-600' : 'border-blue-600'}`}>
        
        {/* HEADER */}
        <div className={`p-4 md:p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors duration-500 shrink-0 ${isJamb ? 'bg-green-900' : 'bg-blue-900'}`}>
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-center gap-3">
                    <div className={`bg-white p-1.5 md:p-2 rounded-full border-2 ${isJamb ? 'border-yellow-500' : 'border-white'}`}>
                        <AcenexaLogo className={`w-6 h-6 md:w-8 md:h-8`} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">ACENEXA</h1>
                        <p className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider text-yellow-400`}>{examType} CBT Portal</p>
                    </div>
                </div>
                {/* Mobile Logout Button */}
                 <button onClick={onLogout} className="md:hidden text-xs bg-red-600 px-3 py-2 rounded hover:bg-red-700 transition flex items-center gap-1 font-bold shadow-md">
                        <LogOut size={14}/>
                 </button>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-0 border-white/20 pt-3 md:pt-0">
                <div className="text-left md:text-right">
                    <p className="font-bold text-sm truncate max-w-[150px] md:max-w-none">{user.fullName || user.username}</p>
                    <p className="text-green-100/80 text-xs font-mono">{user.regNumber}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleTheme} className="text-xs bg-black/20 px-3 py-2 rounded hover:bg-black/30 transition flex items-center gap-1 border border-white/10" title="Toggle Theme">
                        {theme === 'light' ? <Moon size={14}/> : <Sun size={14} className="text-yellow-400"/>}
                    </button>
                    <button onClick={() => setShowContact(true)} className="text-xs bg-black/20 px-3 py-2 rounded hover:bg-black/30 transition flex items-center gap-1 border border-white/10" title="Contact Support">
                        <MessageSquare size={14}/>
                    </button>
                    <button onClick={() => setShowPwdModal(true)} className="text-xs bg-black/20 px-3 py-2 rounded hover:bg-black/30 transition flex items-center gap-1 border border-white/10" title="Change Password">
                        <Key size={14}/>
                    </button>
                    <button onClick={onLogout} className="hidden md:flex text-xs bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition items-center gap-1 font-bold shadow-md">
                        <LogOut size={14}/>
                    </button>
                </div>
            </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 overflow-x-auto whitespace-nowrap">
            <button 
                onClick={() => setExamType('JAMB')}
                disabled={user.allowedExamType === 'WAEC'}
                className={`flex-1 py-3 md:py-4 px-4 text-center font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
                    isJamb 
                        ? 'text-green-700 dark:text-green-400 border-b-4 border-green-600 bg-green-50 dark:bg-green-900/20' 
                        : user.allowedExamType === 'WAEC'
                            ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
            >
                {user.allowedExamType !== 'BOTH' && user.allowedExamType !== 'JAMB' && <Lock size={12}/>} JAMB UTME
            </button>
            <button 
                onClick={() => setExamType('WAEC')}
                disabled={user.allowedExamType === 'JAMB'}
                className={`flex-1 py-3 md:py-4 px-4 text-center font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
                    examType === 'WAEC'
                        ? 'text-blue-700 dark:text-blue-400 border-b-4 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : user.allowedExamType === 'JAMB'
                            ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
            >
                {user.allowedExamType !== 'BOTH' && user.allowedExamType !== 'WAEC' && <Lock size={12}/>} WAEC SSCE
            </button>
        </div>

        <div className="flex-1 p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-y-auto custom-scroll">
          {/* LEFT: Exam Setup */}
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-end mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    {isJamb ? <CheckCircle size={20} className="text-green-600"/> : <Layers size={20} className="text-blue-600"/>}
                    {isJamb ? 'Combination' : 'Choose Subject'}
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${isJamb ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                    {isJamb ? 'Multi-Subject' : 'Single Subject'}
                </span>
            </div>
            
            {hasSavedSession && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg flex flex-col gap-3 shadow-sm animate-pulse">
                    <div className="flex gap-3">
                        <PlayCircle className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-1" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                            <p className="font-bold">Exam in Progress</p>
                            <p>You have an unfinished session.</p>
                        </div>
                    </div>
                    <Button onClick={onResume} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white w-full border-yellow-700 font-bold">
                        Resume Exam
                    </Button>
                </div>
            )}

            {/* Compulsory Section (Only for JAMB) */}
            {isJamb && (
                <div className="mb-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm md:text-base flex items-center gap-2">
                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">1</span> 
                        Compulsory <span className="text-xs text-gray-400 font-normal">(Included)</span>
                    </h3>
                    <div className="space-y-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-l-4 border-green-600 rounded flex items-center justify-between shadow-sm">
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">English Language</span>
                            <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                        </div>
                    </div>
                </div>
            )}

            {/* Subject Lists */}
            <div className="flex-1 min-h-[200px] mb-6">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex justify-between text-sm md:text-base items-center">
                    <span className="flex items-center gap-2">
                        {isJamb && <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</span>}
                        {isJamb ? `Select ${targetCount} Electives` : 'Select One Subject'}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${isValid ? (isJamb ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300') : 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300'}`}>
                        {selected.length}/{targetCount}
                    </span>
                </h3>
                
                <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scroll space-y-4">
                    {isJamb ? (
                        jambSubjects.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {jambSubjects.map(renderSubjectButton)}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p className="text-sm">Loading subjects...</p>
                            </div>
                        )
                    ) : (
                        // WAEC Grouped Layout
                        Object.keys(waecSubjects).length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(waecSubjects).map(([category, subjects]) => (
                                    <div key={category}>
                                        <h4 className={`text-xs font-extrabold uppercase mb-2 border-b pb-1 flex items-center gap-2 ${
                                            category.includes('General') ? 'text-purple-600 border-purple-200 dark:text-purple-400 dark:border-purple-800' :
                                            category.includes('Science') ? 'text-teal-600 border-teal-200 dark:text-teal-400 dark:border-teal-800' :
                                            category.includes('Commercial') ? 'text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800' :
                                            'text-pink-600 border-pink-200 dark:text-pink-400 dark:border-pink-800'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                category.includes('General') ? 'bg-purple-500' :
                                                category.includes('Science') ? 'bg-teal-500' :
                                                category.includes('Commercial') ? 'bg-amber-500' :
                                                'bg-pink-500'
                                            }`}></span>
                                            {category}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {subjects.map(renderSubjectButton)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p className="text-sm">Loading subjects...</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Common Start Button */}
            <Button 
                onClick={() => onStartExam(selected)} 
                disabled={!isValid}
                className={`w-full py-4 text-lg font-bold shadow-md transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2 shrink-0 ${
                    isValid 
                    ? (isJamb ? 'bg-green-700 hover:bg-green-800 border-green-800 text-white' : 'bg-blue-700 hover:bg-blue-800 border-blue-800 text-white')
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
            >
                <MousePointer2 size={24} />
                {isValid ? `Start ${isJamb ? 'JAMB' : selected[0] + ' Exam'}` : 'Select Subject to Begin'}
            </Button>
          </div>

          {/* RIGHT: History */}
          <div className="bg-gray-50 dark:bg-gray-700/30 p-4 md:p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-full min-h-[300px]">
             <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 pb-2">
                 <History className="text-gray-500 dark:text-gray-400"/> Recent Results
             </h2>
             
             {history.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 italic">
                     <Calendar size={48} className="mb-2 opacity-20"/>
                     <p>No exams taken yet.</p>
                 </div>
             ) : (
                 <div className="overflow-y-auto max-h-[400px] space-y-3 pr-2 custom-scroll">
                     {history.map((res) => {
                         const rType = res.session.examType || 'JAMB';
                         const isResJamb = rType === 'JAMB';
                         
                         return (
                         <div key={res.id} className={`bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 ${isResJamb ? 'border-l-green-500' : 'border-l-blue-500'} border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group relative`}>
                             <div className="flex justify-between items-start mb-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                                 <div className="flex flex-col">
                                     <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{formatDate(res.timestamp)}</span>
                                     <span className={`text-[10px] font-bold px-1 rounded w-fit mt-1 ${isResJamb ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}`}>{rType}</span>
                                 </div>
                                 <div className="text-right">
                                     <span className={`block text-2xl font-black leading-none ${isResJamb ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                         {res.aggregateScore}
                                     </span>
                                     <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500 font-bold">/ 400 Agg.</span>
                                 </div>
                             </div>
                             <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2">
                                 {Object.entries(res.subjectScores).slice(0, 4).map(([sub, score]) => { // Limit preview to 4
                                     const s = score as { score: number, total: number };
                                     return (
                                     <div key={sub} className="flex justify-between">
                                         <span className="text-gray-600 dark:text-gray-400 truncate max-w-[70px]">{sub}:</span>
                                         <span className="font-bold text-gray-800 dark:text-gray-200">{s.score}/{s.total}</span>
                                     </div>
                                     );
                                 })}
                                 {Object.keys(res.subjectScores).length > 4 && (
                                     <div className="col-span-2 text-center text-gray-400 italic text-[10px]">+ {Object.keys(res.subjectScores).length - 4} more subjects</div>
                                 )}
                             </div>
                             <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                 <button 
                                    onClick={() => onReview(res)}
                                    className={`${isResJamb ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-700 hover:bg-blue-600'} text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transform scale-90 group-hover:scale-100 transition-transform flex items-center gap-2`}
                                 >
                                     <Eye size={16}/> Review Corrections
                                 </button>
                             </div>
                         </div>
                         );
                     })}
                 </div>
             )}
          </div>
        </div>

        {/* Change Password Modal */}
        {showPwdModal && (
            <div className="fixed inset-0 bg-green-900/80 dark:bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-sm shadow-2xl border-t-4 border-yellow-500">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Change Password</h3>
                        <button onClick={() => setShowPwdModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Old Password</label>
                            <input 
                                type="password"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={pwdData.old}
                                onChange={e => setPwdData({...pwdData, old: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">New Password</label>
                            <input 
                                type="password"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={pwdData.new}
                                onChange={e => setPwdData({...pwdData, new: e.target.value})}
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Confirm New</label>
                            <input 
                                type="password"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={pwdData.confirm}
                                onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                                required
                            />
                        </div>
                        <Button className="w-full bg-green-700 hover:bg-green-800 text-white">Save Changes</Button>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
