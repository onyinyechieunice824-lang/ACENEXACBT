
import React, { useState, useEffect } from 'react';
import { Subject, Question, ExamType, SubjectInfo } from '../types';
import { addQuestionToBank, getBankStats, resetDatabase, clearStudentResults, addBulkQuestions, fetchAllQuestions, deleteQuestion, getAllSubjects, addSubject, deleteSubject } from '../services/db';
import { registerStudent, getAllStudents, deleteStudent, User, changePassword, generateManualToken, generateLocalTokenImmediate, getAllTokens, TokenInfo, updateAdminCredentials, toggleTokenStatus, resetTokenDevice, deleteToken } from '../services/auth';
import { LogOut, Upload, Save, Database, FileText, CheckCircle, AlertTriangle, RefreshCw, Trash2, ShieldAlert, Users, Plus, Settings, List, Moon, Sun, Search, GraduationCap, Banknote, Copy, Check, Ban, Phone, User as UserIcon, Smartphone, WifiOff, X, BookOpen } from 'lucide-react';
import { Button } from './Button';

interface Props {
  onBack: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isOnline: boolean;
}

interface LogEntry {
  line: number;
  status: 'success' | 'error';
  message: string;
}

export const AdminPanel: React.FC<Props> = ({ onBack, theme, toggleTheme, isOnline }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'add' | 'bulk' | 'questions' | 'tokens' | 'settings' | 'subjects'>('stats');
  const [stats, setStats] = useState(getBankStats());
  const [isLoading, setIsLoading] = useState(false);

  // Subject Management State
  const [allSubjects, setAllSubjects] = useState<SubjectInfo[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCategory, setNewSubjectCategory] = useState<'General' | 'Science' | 'Commercial' | 'Arts'>('Science');
  
  // Student Management State
  const [students, setStudents] = useState<User[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentReg, setNewStudentReg] = useState('');

  // Token Management State
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [manualTokenData, setManualTokenData] = useState({ 
      reference: '', 
      amount: '3000',
      fullName: '',
      phoneNumber: '',
      examType: 'BOTH' as 'JAMB' | 'WAEC' | 'BOTH'
  });
  const [lastGeneratedToken, setLastGeneratedToken] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  // Inline Action States (Replace window.confirm)
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const [tokenToReset, setTokenToReset] = useState<string | null>(null);
  const [tokenToToggle, setTokenToToggle] = useState<string | null>(null);

  // Question Bank View State
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Admin Profile Update State
  const [adminProfile, setAdminProfile] = useState({
      currentUsername: '',
      currentPassword: '',
      newUsername: '',
      newPassword: '',
      confirmPassword: ''
  });

  // Question Management State
  const [targetExam, setTargetExam] = useState<ExamType>('JAMB');
  const [newQ, setNewQ] = useState<Partial<Question>>({ subject: 'Mathematics', correctOption: 'A' });
  const [bulkText, setBulkText] = useState('');
  const [uploadLog, setUploadLog] = useState<LogEntry[]>([]);

  // Async data loaders
  const loadStudents = async () => {
    try {
        const list = await getAllStudents();
        setStudents(list);
    } catch(e) { console.error(e); }
  };

  const loadTokens = async () => {
      try {
          const list = await getAllTokens();
          setTokens(list);
      } catch(e) { console.error("Failed to load tokens:", e); }
  };

  const loadSubjects = async () => {
      try {
          const list = await getAllSubjects();
          setAllSubjects(list);
      } catch(e) { console.error("Failed to load subjects:", e); }
  };

  const loadQuestions = async () => {
      setIsLoading(true);
      try {
          const qs = await fetchAllQuestions();
          setAllQuestions(qs);
          setStats(getBankStats());
      } catch(e) { console.error(e); }
      setIsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'users') loadStudents();
    if (activeTab === 'tokens') loadTokens();
    if (activeTab === 'subjects') loadSubjects();
    if (activeTab === 'questions' || activeTab === 'stats' || activeTab === 'add' || activeTab === 'bulk') {
        loadQuestions();
        loadSubjects(); // Load subjects for dropdown
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'questions') {
        const lowerTerm = searchTerm.toLowerCase();
        setFilteredQuestions(allQuestions.filter(q => 
            q.text.toLowerCase().includes(lowerTerm) || 
            q.subject.toLowerCase().includes(lowerTerm) ||
            q.id.toLowerCase().includes(lowerTerm)
        ));
    }
  }, [searchTerm, allQuestions, activeTab]);

  // Update default amount when exam type changes
  const handleExamTypeChange = (type: 'JAMB' | 'WAEC' | 'BOTH') => {
      let amount = '3000';
      if (type === 'JAMB') amount = '1500';
      if (type === 'WAEC') amount = '1500';
      
      setManualTokenData(prev => ({
          ...prev,
          examType: type,
          amount: amount
      }));
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentReg) return;
    try {
      await registerStudent(newStudentName, newStudentReg);
      await loadStudents();
      setNewStudentName('');
      setNewStudentReg('');
      alert("Candidate registered successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateManualToken = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const amt = parseInt(manualTokenData.amount);
      if (isNaN(amt)) {
          alert("Please enter a valid amount");
          return;
      }

      setIsLoading(true);

      // Create a timeout promise that rejects after 8 seconds
      const timeoutPromise = new Promise((_, reject) => {
          const id = setTimeout(() => {
              clearTimeout(id);
              reject(new Error("TIMEOUT"));
          }, 8000);
      });

      try {
          // Race the actual generation request against the timeout
          const res: any = await Promise.race([
              generateManualToken(
                  manualTokenData.reference || `CASH-${Date.now()}`, 
                  amt, 
                  manualTokenData.examType,
                  manualTokenData.fullName,
                  manualTokenData.phoneNumber
              ),
              timeoutPromise
          ]);
          
          setLastGeneratedToken(res.token);
      } catch(err: any) {
          // If it's a timeout, force immediate local generation
          if (err.message === "TIMEOUT" || err.message.includes("timed out")) {
              console.warn("Request timed out, forcing local generation.");
              const fallbackRes = generateLocalTokenImmediate(
                  manualTokenData.reference || `CASH-${Date.now()}`, 
                  amt, 
                  manualTokenData.examType,
                  manualTokenData.fullName,
                  manualTokenData.phoneNumber
              );
              setLastGeneratedToken(fallbackRes.token);
          } else {
              console.error("Token Generation Failed:", err);
              alert("Generation failed: " + (err.message || "Unknown error"));
          }
      } finally {
          setIsLoading(false);
          setManualTokenData(prev => ({ 
              ...prev, 
              reference: '', 
              fullName: '', 
              phoneNumber: '' 
          }));
          loadTokens();
      }
  };

  const copyToken = (token: string) => {
      navigator.clipboard.writeText(token).then(() => {
          setCopiedToken(token);
          setTimeout(() => setCopiedToken(null), 2000);
      }).catch(err => {
          console.error('Failed to copy: ', err);
          alert("Access Code Copied!");
      });
  };

  // --- INLINE ACTION HANDLERS (No window.confirm) ---

  const cancelAction = () => {
      setTokenToDelete(null);
      setTokenToReset(null);
      setTokenToToggle(null);
  };

  // 1. Reset Device Lock
  const initiateResetDevice = (e: React.MouseEvent, tokenCode: string) => {
      e.preventDefault();
      e.stopPropagation();
      setTokenToReset(tokenCode);
      setTokenToToggle(null);
      setTokenToDelete(null);
  };

  const confirmResetDevice = async (tokenCode: string) => {
      setTokenToReset(null);
      try {
          await resetTokenDevice(tokenCode);
          await loadTokens();
      } catch(e: any) {
          alert("Failed: " + e.message);
      }
  };

  // 2. Toggle Status (Activate/Deactivate)
  const initiateToggleStatus = (e: React.MouseEvent, tokenCode: string) => {
      e.preventDefault();
      e.stopPropagation();
      setTokenToToggle(tokenCode);
      setTokenToReset(null);
      setTokenToDelete(null);
  };

  const confirmToggleStatus = async (tokenCode: string, currentStatus: boolean) => {
      setTokenToToggle(null);
      try {
          await toggleTokenStatus(tokenCode, !currentStatus);
          await loadTokens();
      } catch(e: any) {
          alert("Failed: " + e.message);
      }
  };

  // 3. Delete Token
  const initiateDeleteToken = (e: React.MouseEvent, tokenCode: string) => {
      e.preventDefault();
      e.stopPropagation();
      setTokenToDelete(tokenCode);
      setTokenToReset(null);
      setTokenToToggle(null);
  };

  const confirmDeleteToken = async (tokenCode: string) => {
      setTokenToDelete(null);
      setIsLoading(true);
      try {
          await deleteToken(tokenCode);
          setTokens(prev => prev.filter(t => t.token_code !== tokenCode));
          await loadTokens();
      } catch(e: any) {
          alert("Failed: " + e.message);
      }
      setIsLoading(false);
  };

  // 4. Delete All Questions
  const handleDeleteAllQuestions = async () => {
      setIsLoading(true);
      try {
          await resetDatabase(true);
          await loadQuestions();
          setConfirmDeleteAll(false);
          alert("All questions deleted successfully.");
      } catch (e: any) {
          alert("Failed to delete all: " + e.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteStudent = async (username: string) => {
    if (confirm(`Delete student ${username}?`)) {
      try {
          await deleteStudent(username);
          await loadStudents();
      } catch(e: any) { alert(e.message); }
    }
  };

  const handleDeleteQuestion = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      setTimeout(async () => {
          if (confirm("Delete this question? This cannot be undone.")) {
              try {
                  await deleteQuestion(id);
                  // Refresh UI optimistically
                  setAllQuestions(prev => prev.filter(q => q.id !== id));
              } catch (e: any) {
                  alert("Failed: " + e.message);
              }
          }
      }, 50);
  };

  const handleClearProgress = async (username: string) => {
    if (confirm(`Clear ALL exam records for ${username}?`)) {
        try {
            await clearStudentResults(username);
            alert("Candidate progress cleared.");
        } catch(e: any) { alert(e.message); }
    }
  };

  const handleReset = async () => {
      if(confirm("Wipe all data?")) {
          await resetDatabase(true);
          await loadQuestions();
          alert("Database wiped.");
      }
  };

  const handleWipe = handleReset; 

  const handleSingleAdd = async () => {
    if (!newQ.text || !newQ.optionA || !newQ.optionB) return alert("Fill all fields");
    setIsLoading(true);
    try {
        await addQuestionToBank({
            ...newQ,
            examType: targetExam,
            id: `custom-${Date.now()}`,
        } as Question);
        
        alert(`Question Added & Saved to ${targetExam} Bank!`);
        await loadQuestions();
        setNewQ({ subject: 'Mathematics', correctOption: 'A', text: '', optionA: '', optionB: '', optionC: '', optionD: '' });
    } catch(e: any) { alert(e.message); }
    setIsLoading(false);
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (adminProfile.newPassword !== adminProfile.confirmPassword) {
          return alert("New passwords do not match!");
      }

      try {
          await updateAdminCredentials(
              adminProfile.currentUsername,
              adminProfile.currentPassword,
              adminProfile.newUsername,
              adminProfile.newPassword
          );
          alert("Admin profile updated successfully. Please login with new credentials.");
          onBack(); // Logout to force re-login
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSubjectName.trim()) return alert("Please enter a subject name");

      setIsLoading(true);
      try {
          await addSubject(newSubjectName.trim(), newSubjectCategory);
          await loadSubjects();
          await loadQuestions(); // Refresh stats
          setNewSubjectName('');
          alert(`${newSubjectName} added successfully!`);
      } catch (e: any) {
          alert(e.message);
      }
      setIsLoading(false);
  };

  const handleDeleteSubject = async (id: string, name: string) => {
      if (confirm(`Delete ${name}? This will NOT delete associated questions.`)) {
          setIsLoading(true);
          try {
              await deleteSubject(id);
              await loadSubjects();
              await loadQuestions(); // Refresh stats
              alert(`${name} deleted successfully!`);
          } catch (e: any) {
              alert(e.message);
          }
          setIsLoading(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setBulkText(content);
        setUploadLog([]); 
      };
      reader.readAsText(file);
    }
  };

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQuote && text[i+1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (c === ',' && !inQuote) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur.trim());
    return result;
  };

  const normalizeSubject = (input: string): Subject | null => {
    if (!input) return null;
    const s = input.toLowerCase().trim().replace(/['"]+/g, '');
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('eng')) return 'English';
    if (s.includes('phy')) return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('bio')) return 'Biology';
    if (s.includes('eco')) return 'Economics';
    if (s.includes('gov')) return 'Government';
    if (s.includes('lit')) return 'Literature';
    if (s.includes('crs') || s.includes('christian') || s.includes('rel')) return 'CRS';
    if (s.includes('comm') && !s.includes('computer')) return 'Commerce';
    if (s.includes('agric')) return 'Agricultural Science';
    if (s.includes('geo')) return 'Geography';
    if (s.includes('computer') || s.includes('comp. studies') || s.includes('ict')) return 'Computer Studies';
    if (s.includes('fin') || s.includes('account')) return 'Financial Accounting';
    if (s.includes('civic')) return 'Civic Education';
    if (s.includes('further') && s.includes('math')) return 'Further Mathematics';
    if (s.includes('hist')) return 'History';
    return null;
  };

  const handleBulkUpload = async () => {
    if (!bulkText.trim()) return;
    setIsLoading(true);

    const lines = bulkText.split(/\r?\n/);
    const logs: LogEntry[] = [];
    const validQuestions: Question[] = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (!line.trim()) return;
        
        let parts = line.split('|');
        if (parts.length < 7) {
            parts = parseCSVLine(line);
        }

        if (index === 0 && parts[0].toLowerCase().includes('subject')) {
            logs.push({ line: lineNum, status: 'success', message: 'Skipped Header Row' });
            return;
        }

        if (parts.length < 7) {
            logs.push({ line: lineNum, status: 'error', message: `Line ${lineNum}: Not enough columns.` });
            return;
        }

        const [rawSub, txt, a, b, c, d, rawAns, expl] = parts;
        const subject = normalizeSubject(rawSub);
        
        if (!subject) {
            logs.push({ line: lineNum, status: 'error', message: `Line ${lineNum}: Unknown Subject "${rawSub}".` });
            return;
        }

        const ansMatch = rawAns?.toUpperCase().match(/[A-D]/);
        if (!ansMatch) {
             logs.push({ line: lineNum, status: 'error', message: `Line ${lineNum}: Invalid Answer.` });
             return;
        }
        const correctOption = ansMatch[0] as any;

        validQuestions.push({
            id: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            examType: targetExam, 
            subject: subject,
            text: txt.replace(/^"|"$/g, '').trim(),
            optionA: a.replace(/^"|"$/g, '').trim(),
            optionB: b.replace(/^"|"$/g, '').trim(),
            optionC: c.replace(/^"|"$/g, '').trim(),
            optionD: d.replace(/^"|"$/g, '').trim(),
            correctOption: correctOption,
            explanation: expl ? expl.replace(/^"|"$/g, '').trim() : ''
        });
        
        logs.push({ line: lineNum, status: 'success', message: `Queued for ${subject} [${targetExam}]` });
    });
    
    if (validQuestions.length > 0) {
        try {
            const addedCount = await addBulkQuestions(validQuestions);
            alert(`Successfully added and saved ${addedCount} new questions to ${targetExam} Bank.`);
            if (validQuestions.length > 0) {
                setBulkText('');
            }
        } catch(e: any) {
            alert("Bulk upload failed: " + e.message);
        }
    } else {
        alert("No valid questions found to add.");
    }
    
    setUploadLog(logs);
    await loadQuestions();
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 md:p-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg min-h-[600px] flex flex-col overflow-hidden">
            {/* Header Branding */}
            <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center bg-green-900 text-white gap-4 border-t-4 border-yellow-500">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-full border-2 border-yellow-500">
                        <GraduationCap className="text-green-800 w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold tracking-tight">ACENEXA CBT</h1>
                        <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest">Admin Control Center</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                    <button onClick={() => setActiveTab('stats')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'stats' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}>Stats</button>
                    <button onClick={() => setActiveTab('subjects')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'subjects' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}><BookOpen size={16} className="inline mr-1"/> Subjects</button>
                    <button onClick={() => setActiveTab('tokens')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'tokens' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}><Banknote size={16} className="inline mr-1"/> Tokens</button>
                    <button onClick={() => setActiveTab('users')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'users' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}>Candidates</button>
                    <button onClick={() => setActiveTab('questions')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'questions' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}><List size={16} className="inline mr-1"/> Bank</button>
                    <button onClick={() => setActiveTab('add')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'add' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}>Add</button>
                    <button onClick={() => setActiveTab('bulk')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'bulk' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}>Upload</button>

                    <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm transition-colors ${activeTab === 'settings' ? 'bg-yellow-500 text-green-900' : 'bg-green-800 hover:bg-green-700'}`}>
                        <Settings size={16} className="inline mr-1"/> Settings
                    </button>
                    
                    <button onClick={toggleTheme} className="px-3 py-1.5 rounded font-medium text-xs md:text-sm bg-black/20 hover:bg-black/30 transition-colors text-white" title="Toggle Theme">
                        {theme === 'light' ? <Moon size={16}/> : <Sun size={16} className="text-yellow-400"/>}
                    </button>

                    <button onClick={onBack} className="px-3 py-1.5 md:px-4 md:py-2 rounded font-medium text-xs md:text-sm bg-red-600 hover:bg-red-700 flex items-center gap-2 shadow-lg ml-auto md:ml-2">
                        <LogOut size={16}/> <span className="hidden md:inline">Logout</span>
                    </button>
                </div>
            </div>

            <div className="p-4 md:p-8 flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4 animate-in fade-in duration-300">
                        <RefreshCw className="w-8 h-8 text-green-600 animate-spin mb-2" />
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Processing Request...</span>
                    </div>
                )}

                {!isOnline && (
                    <div className="mb-6 p-4 bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500 text-orange-800 dark:text-orange-200 rounded-r shadow-sm">
                        <div className="flex items-center gap-2 font-bold mb-1"><WifiOff size={18}/> Offline Mode Detected</div>
                        <p className="text-xs">Bulk uploads and online token generation are disabled until connection is restored. Local changes will be saved.</p>
                    </div>
                )}
                
                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {Object.entries(stats).map(([sub, counts]) => {
                                const c = counts as { JAMB: number, WAEC: number };
                                const total = c.JAMB + c.WAEC;
                                return (
                                <div key={sub} className={`p-4 md:p-6 rounded-lg border-b-4 text-center bg-white dark:bg-gray-800 shadow-sm transition-transform hover:-translate-y-1 ${total >= 20 ? 'border-green-500' : 'border-orange-500'}`}>
                                    <Database className={`mx-auto mb-2 ${total >= 20 ? 'text-green-500' : 'text-orange-500'}`} />
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm md:text-base">{sub}</h3>
                                    <div className="flex flex-wrap justify-center gap-1 my-2 text-[10px] font-mono">
                                        <span className="bg-green-100 text-green-800 px-1 rounded">J: {c.JAMB}</span>
                                        <span className="bg-blue-100 text-blue-800 px-1 rounded">W: {c.WAEC}</span>
                                    </div>
                                    <p className={`text-[10px] md:text-xs uppercase font-bold tracking-wide ${total >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
                                        {total >= 20 ? 'Ready' : 'Low Data'}
                                    </p>
                                </div>
                                );
                            })}
                        </div>
                        
                        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                             <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <ShieldAlert className="text-red-600"/> Danger Zone
                             </h3>
                             <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={handleWipe} className="px-6 py-3 rounded bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 font-bold shadow-md text-sm">
                                    <Trash2 size={16}/> Wipe All Data
                                </button>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tokens' && (
                    <div className="h-full flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                             <h3 className="font-bold text-gray-800 dark:text-white mb-4 border-b pb-2">Generate Manual Code</h3>
                             <p className="text-xs text-gray-500 mb-4">Create access codes for Cash or Transfer payments.</p>
                             
                             <form onSubmit={handleGenerateManualToken} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Candidate Full Name</label>
                                    <input 
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" 
                                        placeholder="e.g. John Doe" 
                                        value={manualTokenData.fullName} 
                                        onChange={e => setManualTokenData({...manualTokenData, fullName: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                    <input 
                                        type="tel"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" 
                                        placeholder="e.g. 08012345678" 
                                        value={manualTokenData.phoneNumber} 
                                        onChange={e => setManualTokenData({...manualTokenData, phoneNumber: e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Access Type</label>
                                    <select 
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white font-bold text-sm"
                                        value={manualTokenData.examType}
                                        onChange={e => handleExamTypeChange(e.target.value as any)}
                                    >
                                        <option value="BOTH">FULL ACCESS (JAMB + WAEC)</option>
                                        <option value="JAMB">JAMB Only</option>
                                        <option value="WAEC">WAEC Only</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Reference</label>
                                        <input 
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" 
                                            placeholder="Optional" 
                                            value={manualTokenData.reference} 
                                            onChange={e => setManualTokenData({...manualTokenData, reference: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (NGN)</label>
                                        <input 
                                            type="number"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" 
                                            value={manualTokenData.amount} 
                                            onChange={e => setManualTokenData({...manualTokenData, amount: e.target.value})} 
                                            required
                                        />
                                    </div>
                                </div>
                                <Button 
                                    isLoading={isLoading} 
                                    className={`w-full text-white ${!isOnline ? 'bg-orange-600' : 'bg-green-700'}`}
                                    title={!isOnline ? 'Will generate locally' : 'Will try online first'}
                                >
                                    {!isOnline ? 'Generate Offline Code' : 'Generate Code'}
                                </Button>
                             </form>

                             {lastGeneratedToken && (
                                 <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-center animate-pulse">
                                     <p className="text-xs text-green-600 dark:text-green-400 font-bold mb-1">Generated Access Code</p>
                                     <div className="text-2xl font-mono font-black text-green-900 dark:text-green-100 tracking-wider mb-2 break-all">{lastGeneratedToken}</div>
                                     <button onClick={() => copyToken(lastGeneratedToken)} className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-3 py-1 rounded flex items-center gap-1 mx-auto hover:bg-green-300">
                                         {copiedToken === lastGeneratedToken ? <><CheckCircle size={12}/> Copied!</> : <><Copy size={12}/> Copy Code</>}
                                     </button>
                                 </div>
                             )}
                        </div>

                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 font-bold text-sm text-gray-700 dark:text-gray-200">Recent Tokens</div>
                            <div className="overflow-auto flex-1 p-0 w-full">
                                <table className="w-full text-sm text-left whitespace-nowrap md:whitespace-normal">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Details</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                            <th className="px-4 py-3 text-right">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tokens.map(t => (
                                            <tr key={t.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-green-700 dark:text-green-400">{t.token_code}</span>
                                                        <button 
                                                            onClick={() => copyToken(t.token_code)}
                                                            className="text-gray-400 hover:text-green-600 transition-colors bg-gray-100 dark:bg-gray-700 p-1 rounded"
                                                            title="Copy Code"
                                                        >
                                                            {copiedToken === t.token_code ? <CheckCircle size={12} className="text-green-600"/> : <Copy size={12}/>}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300 text-xs">
                                                    {t.metadata?.full_name || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    <div className="mb-1">
                                                        <span className="text-[9px] bg-gray-200 dark:bg-gray-600 px-1 rounded font-bold">{t.metadata?.exam_type || 'BOTH'}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1"><Phone size={10}/> {t.metadata?.phone_number || 'N/A'}</span>
                                                        <span className="text-[10px] text-gray-400">Ref: {t.metadata?.payment_ref || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {t.is_active ? 'Active' : 'Deactivated'}
                                                    </span>
                                                    {t.device_fingerprint && (
                                                        <div className="text-[9px] text-blue-600 mt-1 font-mono bg-blue-50 px-1 rounded w-fit">Locked</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {tokenToReset === t.token_code ? (
                                                        <div className="flex justify-end gap-1 relative z-10 animate-in fade-in zoom-in duration-200">
                                                             <span className="text-[10px] font-bold text-orange-500 self-center mr-1">Unlock?</span>
                                                             <button type="button" onClick={() => confirmResetDevice(t.token_code)} className="px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 text-xs font-bold shadow-sm">Yes</button>
                                                             <button type="button" onClick={cancelAction} className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"><X size={14}/></button>
                                                        </div>
                                                    ) : tokenToToggle === t.token_code ? (
                                                        <div className="flex justify-end gap-1 relative z-10 animate-in fade-in zoom-in duration-200">
                                                             <span className="text-[10px] font-bold text-blue-500 self-center mr-1">{t.is_active ? 'Deactivate?' : 'Activate?'}</span>
                                                             <button type="button" onClick={() => confirmToggleStatus(t.token_code, t.is_active)} className={`px-2 py-1 rounded text-white text-xs font-bold shadow-sm ${t.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>Yes</button>
                                                             <button type="button" onClick={cancelAction} className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"><X size={14}/></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2 relative z-10">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => initiateResetDevice(e, t.token_code)}
                                                                className="p-2 rounded text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer transition-colors"
                                                                title="Reset Device Lock"
                                                            >
                                                                <Smartphone size={16} className="pointer-events-none"/>
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => initiateToggleStatus(e, t.token_code)}
                                                                className={`p-2 rounded cursor-pointer transition-colors ${t.is_active ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                                                title={t.is_active ? "Deactivate Token" : "Activate Token"}
                                                            >
                                                                {t.is_active ? <Ban size={16} className="pointer-events-none"/> : <CheckCircle size={16} className="pointer-events-none"/>}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {tokenToDelete === t.token_code ? (
                                                        <div className="flex justify-end gap-1 relative z-10 animate-in fade-in zoom-in duration-200">
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDeleteToken(t.token_code)}
                                                                className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs font-bold shadow-sm"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelAction}
                                                                className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"
                                                            >
                                                                <X size={14}/>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2 relative z-10">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => initiateDeleteToken(e, t.token_code)}
                                                                className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
                                                                title="Delete Token"
                                                            >
                                                                <Trash2 size={16} className="pointer-events-none"/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {tokens.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-4 text-center text-gray-400 text-xs">No tokens generated yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'questions' && (
                     <div className="h-full flex flex-col">
                        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search questions..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {confirmDeleteAll ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right duration-200 bg-red-50 dark:bg-red-900/20 p-1 rounded border border-red-100 dark:border-red-800">
                                    <span className="text-xs font-bold text-red-600 dark:text-red-400 pl-2">Delete ALL {allQuestions.length}?</span>
                                    <button 
                                        onClick={handleDeleteAllQuestions} 
                                        className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-red-700"
                                    >
                                        Yes
                                    </button>
                                    <button 
                                        onClick={() => setConfirmDeleteAll(false)} 
                                        className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-600"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setConfirmDeleteAll(true)}
                                    className="bg-white dark:bg-gray-800 text-red-500 border border-red-200 dark:border-red-900/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm whitespace-nowrap"
                                >
                                    <Trash2 size={16} /> <span className="hidden md:inline">Delete All</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-auto">
                            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300 whitespace-nowrap md:whitespace-normal">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Exam</th>
                                        <th className="px-4 py-3">Subject</th>
                                        <th className="px-4 py-3">Question</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQuestions.slice(0, 100).map((q) => (
                                        <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3">{q.examType}</td>
                                            <td className="px-4 py-3">{q.subject}</td>
                                            <td className="px-4 py-3 truncate max-w-md">{q.text}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteQuestion(e, q.id)} 
                                                    className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="Delete Question"
                                                >
                                                    <Trash2 size={16} className="pointer-events-none"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>
                )}
                
                {activeTab === 'users' && (
                    <div className="h-full flex flex-col">
                         <div className="flex flex-col lg:flex-row gap-6 mb-8">
                             <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                                 <h3 className="font-bold mb-4">Register Candidate</h3>
                                 <form onSubmit={handleCreateStudent} className="space-y-4">
                                     <input className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="Name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                                     <input className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="Reg No" value={newStudentReg} onChange={e => setNewStudentReg(e.target.value)} required />
                                     <Button className="w-full bg-green-700 text-white">Register</Button>
                                 </form>
                             </div>
                             <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto max-h-[500px]">
                                 <table className="w-full text-sm text-left whitespace-nowrap md:whitespace-normal">
                                     <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500">
                                         <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Reg No</th><th className="px-6 py-3 text-right">Action</th></tr>
                                     </thead>
                                     <tbody>
                                         {students.map(s => (
                                             <tr key={s.username} className="border-b dark:border-gray-700">
                                                 <td className="px-6 py-4">{s.fullName}</td>
                                                 <td className="px-6 py-4 font-mono">{s.username}</td>
                                                 <td className="px-6 py-4 text-right">
                                                     <button onClick={() => handleClearProgress(s.username)} className="text-orange-500 mr-2"><RefreshCw size={16}/></button>
                                                     <button onClick={() => handleDeleteStudent(s.username)} className="text-red-500"><Trash2 size={16}/></button>
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-md mx-auto mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b pb-2 flex items-center gap-2">
                            <Settings className="text-gray-500"/> Admin Security Settings
                        </h3>
                        <form onSubmit={handleUpdateAdminProfile} className="space-y-4">
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200 mb-4">
                                To change your username or password, please verify your current credentials first.
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Username</label>
                                    <input 
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                        value={adminProfile.currentUsername}
                                        onChange={e => setAdminProfile({...adminProfile, currentUsername: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Password</label>
                                    <input 
                                        type="password"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                        value={adminProfile.currentPassword}
                                        onChange={e => setAdminProfile({...adminProfile, currentPassword: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <hr className="dark:border-gray-700"/>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Username</label>
                                <input 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                    value={adminProfile.newUsername}
                                    onChange={e => setAdminProfile({...adminProfile, newUsername: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Password</label>
                                <input 
                                    type="password"
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                    value={adminProfile.newPassword}
                                    onChange={e => setAdminProfile({...adminProfile, newPassword: e.target.value})}
                                    required
                                    minLength={5}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm New Password</label>
                                <input 
                                    type="password"
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                    value={adminProfile.confirmPassword}
                                    onChange={e => setAdminProfile({...adminProfile, confirmPassword: e.target.value})}
                                    required
                                />
                            </div>

                            <Button disabled={!isOnline} className={`w-full text-white mt-4 ${!isOnline ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700'}`}>
                                {isOnline ? 'Update Admin Credentials' : 'Disabled Offline'}
                            </Button>
                        </form>
                    </div>
                )}

                {activeTab === 'subjects' && (
                    <div className="h-full flex flex-col md:flex-row gap-6">
                         <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                             <h3 className="font-bold text-gray-800 dark:text-white mb-4 border-b pb-2">Add New Subject</h3>
                             <form onSubmit={handleAddSubject} className="space-y-4">
                                 <div>
                                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject Name</label>
                                     <input
                                         className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                         placeholder="e.g. French"
                                         value={newSubjectName}
                                         onChange={e => setNewSubjectName(e.target.value)}
                                         required
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                     <select
                                         className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white font-bold text-sm"
                                         value={newSubjectCategory}
                                         onChange={e => setNewSubjectCategory(e.target.value as any)}
                                     >
                                         <option value="General">General (Core)</option>
                                         <option value="Science">Science</option>
                                         <option value="Commercial">Commercial</option>
                                         <option value="Arts">Arts</option>
                                     </select>
                                 </div>
                                 <Button
                                     isLoading={isLoading}
                                     className="w-full text-white bg-green-700"
                                 >
                                     <Plus size={16} className="inline mr-1"/> Add Subject
                                 </Button>
                             </form>
                        </div>

                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 font-bold text-sm text-gray-700 dark:text-gray-200 flex justify-between items-center">
                                <span>All Subjects ({allSubjects.length})</span>
                            </div>
                            <div className="overflow-auto flex-1 p-0 w-full">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Subject Name</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3 text-center">Questions</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allSubjects.map(s => {
                                            const counts = stats[s.name] || { JAMB: 0, WAEC: 0 };
                                            const total = counts.JAMB + counts.WAEC;
                                            return (
                                            <tr key={s.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3">
                                                    <span className="font-bold text-gray-800 dark:text-gray-200">{s.name}</span>
                                                    {s.is_compulsory && <span className="ml-2 text-[9px] bg-yellow-100 text-yellow-800 px-1 rounded font-bold">COMPULSORY</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        s.category === 'General' ? 'bg-purple-100 text-purple-700' :
                                                        s.category === 'Science' ? 'bg-teal-100 text-teal-700' :
                                                        s.category === 'Commercial' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-pink-100 text-pink-700'
                                                    }`}>
                                                        {s.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-2 text-xs">
                                                        <span className="bg-green-100 text-green-800 px-2 rounded font-mono">J: {counts.JAMB}</span>
                                                        <span className="bg-blue-100 text-blue-800 px-2 rounded font-mono">W: {counts.WAEC}</span>
                                                        <span className="font-bold">= {total}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteSubject(s.id, s.name)}
                                                        className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        title="Delete Subject"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                        {allSubjects.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-4 text-center text-gray-400 text-xs">No subjects yet. Add your first subject!</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {(activeTab === 'add' || activeTab === 'bulk') && (
                     <div className="p-4">
                         {/* Exam Selector */}
                         <div className="flex justify-center gap-4 mb-6">
                             <button onClick={() => setTargetExam('JAMB')} className={`px-4 py-2 rounded font-bold ${targetExam === 'JAMB' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>JAMB</button>
                             <button onClick={() => setTargetExam('WAEC')} className={`px-4 py-2 rounded font-bold ${targetExam === 'WAEC' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>WAEC</button>
                         </div>
                         
                         {activeTab === 'add' && (
                             <div className="max-w-lg mx-auto space-y-4">
                                 <select className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" value={newQ.subject} onChange={e => setNewQ({...newQ, subject: e.target.value as Subject})}>
                                     {allSubjects.length > 0 ? allSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>) : <option>Loading subjects...</option>}
                                 </select>
                                 <textarea className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:text-white" placeholder="Question Text" value={newQ.text || ''} onChange={e => setNewQ({...newQ, text: e.target.value})} />
                                 <div className="grid grid-cols-2 gap-2">
                                     {['A','B','C','D'].map(opt => (
                                         <input key={opt} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder={`Option ${opt}`} value={(newQ as any)[`option${opt}`] || ''} onChange={e => setNewQ({...newQ, [`option${opt}`]: e.target.value})} />
                                     ))}
                                 </div>
                                 <select className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" value={newQ.correctOption} onChange={e => setNewQ({...newQ, correctOption: e.target.value as any})}>
                                     <option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                                 </select>
                                 <Button onClick={handleSingleAdd} className="w-full bg-green-700 text-white">Save Question</Button>
                             </div>
                         )}

                         {activeTab === 'bulk' && (
                             <div className="space-y-4">
                                 <div className="flex gap-4">
                                     <input type="file" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"/>
                                 </div>
                                 <textarea className="w-full h-48 p-2 border rounded font-mono text-xs dark:bg-gray-700 dark:text-white" value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Paste CSV..."></textarea>
                                 <Button 
                                    onClick={handleBulkUpload} 
                                    disabled={!isOnline}
                                    className={`w-full text-white ${!isOnline ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700'}`}
                                >
                                    {isOnline ? 'Upload' : 'Bulk Upload Disabled Offline'}
                                </Button>
                                 <div className="mt-4 p-2 border rounded max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                                     {uploadLog.map((l, i) => <div key={i} className={`text-xs ${l.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>{l.message}</div>)}
                                 </div>
                             </div>
                         )}
                     </div>
                )}
            </div>
        </div>
    </div>
  );
};
