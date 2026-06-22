// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FIXED_FOODS } from '../data/fixedFoods';
import { supabase } from '../utils/supabase';
import { FoodItem, MealTime, LoggedFood, DayLog, UserProfileData, MultiUserStorage } from '../types/diet';

const INITIAL_DAY_LOG = (): DayLog => ({
  weight: '',
  meals: [],
  habits: {}
});

const DEFAULT_HABITS = [
  '跑 10k Steps Walk',
  '💪 Routine Exercise Workout',
  '🚫 Strict Zero Sugar Cut'
];

function getWeekMonday(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function MultiUserDietTracker() {
  // Global Engine States
  const [db, setDb] = useState<MultiUserStorage>({});
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Modern Auth Gateway States
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regDefaultTarget, setRegDefaultTarget] = useState<number | ''>(2500);

  // Dashboard Operations States
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime>('Breakfast');
  const [selectedFoodIndex, setSelectedFoodIndex] = useState<number>(0);
  const [servings, setServings] = useState<number | ''>(1);
  const [weeklyTargetInput, setWeeklyTargetInput] = useState<number | ''>('');

  // Custom Habits Manager State
  const [newHabitName, setNewHabitName] = useState('');

  // Custom Ingredient Creator States
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCal, setNewFoodCal] = useState<number | ''>('');
  const [newFoodProt, setNewFoodProt] = useState<number | ''>('');
  const [newFoodCarb, setNewFoodCarb] = useState<number | ''>('');
  const [newFoodFat, setNewFoodFat] = useState<number | ''>('');
  const [newFoodFib, setNewFoodFib] = useState<number | ''>('');

  // Trigger State for high-fidelity interactive animations
  const [quantumTriggerHabit, setQuantumTriggerHabit] = useState<string | null>(null);

  // Initialization & Cloud Data Sync Engine
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    const savedCustom = localStorage.getItem('macrosync_custom_foods');
    const savedTheme = localStorage.getItem('macrosync_theme');
    const savedSession = localStorage.getItem('macrosync_active_session');

    if (savedCustom) setCustomFoods(JSON.parse(savedCustom));
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
    
    if (savedSession) {
      setCurrentUser(savedSession);
      fetchCloudProfile(savedSession);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem('macrosync_custom_foods', JSON.stringify(customFoods));
  }, [customFoods, mounted]);

  useEffect(() => {
    if (mounted && currentUser && db[currentUser]) {
      const dispatchSync = async () => {
        await supabase
          .from('macros_daily_users')
          .update({ profile_data: db[currentUser], updated_at: new Date() })
          .eq('username', currentUser);
      };
      dispatchSync();
    }
  }, [db, currentUser, mounted]);

  const fetchCloudProfile = async (username: string) => {
    const { data, error } = await supabase
      .from('macros_daily_users')
      .select('profile_data')
      .eq('username', username)
      .single();

    if (data && !error) {
      setDb(prev => ({ ...prev, [username]: data.profile_data }));
    }
  };

  // User Space Configurations Handlers
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regUsername.trim().toLowerCase();
    const cleanPass = regPasscode.trim();
    if (!cleanName || !cleanPass) return;

    const targetFloor = regDefaultTarget === '' ? 2000 : Math.max(0, regDefaultTarget);
    const newWorkspace: UserProfileData = {
      username: cleanName,
      defaultTarget: targetFloor,
      weeklyTargets: {},
      habitsList: [...DEFAULT_HABITS], 
      logs: {}
    };

    const { error } = await supabase
      .from('macros_daily_users')
      .insert([{ username: cleanName, passcode: cleanPass, profile_data: newWorkspace }]);

    if (!error) {
      setDb(prev => ({ ...prev, [cleanName]: newWorkspace }));
      setCurrentUser(cleanName);
      localStorage.setItem('macrosync_active_session', cleanName);
      setRegUsername(''); setRegPasscode(''); setRegDefaultTarget(2500);
    } else {
      alert('Username already allocated or connection timeout.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = loginUsername.trim().toLowerCase();
    const cleanPass = loginPasscode.trim();
    if (!cleanName || !cleanPass) return;

    const { data, error } = await supabase
      .from('macros_daily_users')
      .select('profile_data, passcode')
      .eq('username', cleanName)
      .single();

    if (data && !error) {
      if (data.passcode === cleanPass) {
        setDb(prev => ({ ...prev, [cleanName]: data.profile_data }));
        setCurrentUser(cleanName);
        localStorage.setItem('macrosync_active_session', cleanName);
        setLoginUsername(''); setLoginPasscode('');
      } else {
        alert('Invalid profile passcode PIN.');
      }
    } else {
      alert('Profile context workspace not found.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('macrosync_active_session');
  };

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('macrosync_theme', nextTheme ? 'dark' : 'light');
  };

  if (!mounted) return <div className="p-8 text-center text-slate-500">Accessing Cloud Workspace Matrix...</div>;

  // Authorization Wall Entry
  if (!currentUser || !db[currentUser]) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-5 sm:p-8 rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">Macros daily</h1>
              <p className="text-xs text-slate-400 mt-0.5">Cloud Space Architecture</p>
            </div>
            <button onClick={toggleTheme} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-600'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-slate-500/10 border border-slate-500/5">
            <button type="button" onClick={() => setAuthMode('signin')} className={`py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'signin' ? (isDarkMode ? 'bg-slate-800 text-white shadow' : 'bg-white text-blue-600 shadow') : 'text-slate-400'}`}>Sign In</button>
            <button type="button" onClick={() => setAuthMode('signup')} className={`py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'signup' ? (isDarkMode ? 'bg-slate-800 text-white shadow' : 'bg-white text-emerald-600 shadow') : 'text-slate-400'}`}>Sign Up</button>
          </div>

          {authMode === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">User Signature ID</label>
                <input type="text" required placeholder="e.g. akshay" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className={`w-full text-sm rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}/>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Security PIN</label>
                <input type="password" required placeholder="🔒 4-digit PIN" value={loginPasscode} onChange={(e) => setLoginPasscode(e.target.value)} className={`w-full text-sm rounded-lg p-2.5 border focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}/>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg transition-colors">Connect Workspace →</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Unique Username</label>
                <input type="text" required placeholder="e.g. roommate1" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className={`w-full text-sm rounded-lg p-2.5 border focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}/>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Create Security PIN</label>
                <input type="password" required placeholder="Choose a 4-digit PIN" value={regPasscode} onChange={(e) => setRegPasscode(e.target.value)} className={`w-full text-sm rounded-lg p-2.5 border focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}/>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Daily Calories Target</label>
                <input type="number" required min="0" placeholder="e.g. 2800" value={regDefaultTarget} onChange={(e) => setRegDefaultTarget(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`w-full text-sm rounded-lg p-2.5 border focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}/>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-lg transition-colors">Provision Cloud Workspace ✓</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Active Context Calculations
  const userProfile: UserProfileData = db[currentUser];
  const currentWeekMonday = getWeekMonday(selectedDate);
  const activeWeeklyTarget = userProfile.weeklyTargets[currentWeekMonday] || userProfile.defaultTarget;
  const currentDayData: DayLog = userProfile.logs[selectedDate] || INITIAL_DAY_LOG();
  const combinedFoodList = [...FIXED_FOODS, ...customFoods];
  
  const activeHabitsList = userProfile.habitsList || [...DEFAULT_HABITS];
  const dayHabitsState = currentDayData.habits || {};

  const updateProfileData = (updatedLog: Partial<DayLog>) => {
    const freshLogs = { ...userProfile.logs, [selectedDate]: { ...currentDayData, ...updatedLog } };
    setDb(prev => ({ ...prev, [currentUser]: { ...userProfile, logs: freshLogs } }));
  };

  // Add Dynamic Custom Habit Option Action
  const handleCreateCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHabit = newHabitName.trim();
    if (!cleanHabit) return;
    if (activeHabitsList.includes(cleanHabit)) {
      alert('Habit entry matching this description already tracked.');
      return;
    }

    setDb(prev => ({
      ...prev,
      [currentUser]: { ...userProfile, habitsList: [...activeHabitsList, cleanHabit] }
    }));
    setNewHabitName('');
  };

  // Delete Custom Habit Action
  const handleDeleteCustomHabit = (habitName: string) => {
    const updatedHabitList = activeHabitsList.filter(h => h !== habitName);
    
    // Clean data mutations from current logging registry safely
    const freshDayHabits = { ...dayHabitsState };
    delete freshDayHabits[habitName];

    const freshLogs = { ...userProfile.logs, [selectedDate]: { ...currentDayData, habits: freshDayHabits } };

    setDb(prev => ({
      ...prev,
      [currentUser]: {
        ...userProfile,
        habitsList: updatedHabitList,
        logs: freshLogs
      }
    }));
  };

  // Toggle Habit Status with quantum engine animations triggers
  const handleToggleHabit = (habitName: string) => {
    const nextStatus = !dayHabitsState[habitName];
    
    if (nextStatus) {
      setQuantumTriggerHabit(habitName);
      setTimeout(() => setQuantumTriggerHabit(null), 800);
    }

    const freshHabits = { ...dayHabitsState, [habitName]: nextStatus };
    updateProfileData({ habits: freshHabits });
  };

  const handleSetWeeklyTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const targetFloor = weeklyTargetInput === '' ? 0 : Math.max(0, weeklyTargetInput);
    if (targetFloor <= 0) return;
    setDb(prev => ({
      ...prev,
      [currentUser]: { ...userProfile, weeklyTargets: { ...userProfile.weeklyTargets, [currentWeekMonday]: targetFloor } }
    }));
    setWeeklyTargetInput('');
    alert(`Target for week of ${currentWeekMonday} synchronized to ${targetFloor} kcal.`);
  };

  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    const sourceFood = combinedFoodList[selectedFoodIndex];
    const cleanServings = servings === '' ? 1 : Math.max(0, servings);
    if (!sourceFood || cleanServings <= 0) return;

    const loggedItem: LoggedFood = { ...sourceFood, id: crypto.randomUUID(), servings: cleanServings, mealTime: selectedMealTime };
    updateProfileData({ meals: [...currentDayData.meals, loggedItem] });
    setServings(1);
  };

  const handleCreateCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    const customFoodAsset: FoodItem = {
      name: newFoodName,
      calories: newFoodCal === '' ? 0 : Math.max(0, newFoodCal),
      protein: newFoodProt === '' ? 0 : Math.max(0, newFoodProt),
      carbs: newFoodCarb === '' ? 0 : Math.max(0, newFoodCarb),
      fat: newFoodFat === '' ? 0 : Math.max(0, newFoodFat),
      fiber: newFoodFib === '' ? 0 : Math.max(0, newFoodFib)
    };

    setCustomFoods(prev => [...prev, customFoodAsset]);
    setNewFoodName(''); setNewFoodCal(''); setNewFoodProt(''); setNewFoodCarb(''); setNewFoodFat(''); setNewFoodFib('');
    alert(`"${customFoodAsset.name}" appended dynamically to cloud choices.`);
  };

  const handleDeleteLoggedFood = (id: string) => {
    updateProfileData({ meals: currentDayData.meals.filter(m => m.id !== id) });
  };

  const totals = currentDayData.meals.reduce((acc, item) => {
    acc.calories += item.calories * item.servings;
    acc.protein += item.protein * item.servings;
    acc.carbs += item.carbs * item.servings;
    acc.fat += item.fat * item.servings;
    acc.fiber += item.fiber * item.servings;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const calorieDiff = totals.calories - activeWeeklyTarget;
  const isOvershot = calorieDiff > 0;

  // Gamified Core Calculations Matrix
  const totalHabitsCount = activeHabitsList.length;
  const completedHabitsCount = activeHabitsList.filter(h => dayHabitsState[h]).length;
  const habitPercentage = totalHabitsCount > 0 ? Math.round((completedHabitsCount / totalHabitsCount) * 100) : 0;
  const is100Percent = habitPercentage === 100;
  
  const strokeDashoffset = totalHabitsCount > 0 ? 113.09 - (113.09 * completedHabitsCount) / totalHabitsCount : 113.09;

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Date,Week Block,Logged Weight,Meal Time,Food Name,Servings,Total Calories,Protein(g),Carbs(g),Fat(g),Fiber(g)\n";
    Object.keys(userProfile.logs).sort().forEach(dateKey => {
      const logItem = userProfile.logs[dateKey];
      const mon = getWeekMonday(dateKey);
      const w = logItem.weight || 'N/A';
      if (logItem.meals.length === 0) {
        csvContent += `${dateKey},${mon},${w},None,No Logged Intake,0,0,0,0,0,0\n`;
      } else {
        logItem.meals.forEach(m => {
          csvContent += `${dateKey},${mon},${w},${m.mealTime},"${m.name}",${m.servings},${m.calories * m.servings},${m.protein * m.servings},${m.carbs * m.servings},${m.fat * m.servings},${m.fiber * m.servings}\n`;
        });
      }
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${userProfile.username}_diet_logs_${selectedDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const mealTimes: MealTime[] = ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner'];
  const clsBg = isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const clsCard = isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const clsInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-black placeholder-slate-400';
  const clsSubBg = isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100';

  return (
    <div className={`min-h-screen ${clsBg} transition-colors duration-150 pb-12`}>
      
      {/* Dynamic Futuristic Style Block Injector */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes quantumShockwave {
          0% { box-shadow: 0 0 0 0px rgba(16, 185, 129, 0.6), inset 0 0 0px rgba(16, 185, 129, 0); transform: scale(1); }
          20% { box-shadow: 0 0 12px 4px rgba(16, 185, 129, 0.4), inset 0 0 8px rgba(16, 185, 129, 0.3); transform: scale(1.02); }
          100% { box-shadow: 0 0 20px 8px rgba(16, 185, 129, 0), inset 0 0 12px rgba(16, 185, 129, 0); transform: scale(1); }
        }
        @keyframes cyberScanline {
          0% { background-position: 0% 0%; border-color: rgba(16, 185, 129, 0.3); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1); }
          50% { border-color: rgba(6, 182, 212, 0.8); box-shadow: 0 0 30px rgba(6, 182, 212, 0.3), 0 0 0 2px rgba(6, 182, 212, 0.1); }
          100% { background-position: 0% 100%; border-color: rgba(16, 185, 129, 0.3); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1); }
        }
        .animate-quantum-hit { animation: quantumShockwave 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .animate-cyber-complete { animation: cyberScanline 3s infinite linear; background-image: linear-gradient(rgba(16, 185, 129, 0.02) 50%, rgba(6, 182, 212, 0.02) 50%); background-size: 100% 4px; }
      `}} />

      <main className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Branding Header */}
        <header className={`${clsCard} p-4 sm:p-5 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center`}>
          <div className="w-full md:w-auto flex justify-between items-center">
            <div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">Macros daily</h1>
              <p className="text-xs text-blue-500 font-medium">Domain Account: <span className="uppercase font-bold">{userProfile.username}</span></p>
            </div>
            <button onClick={toggleTheme} className={`md:hidden px-3 py-1.5 rounded-lg text-xs font-bold border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-700'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:flex md:flex-row gap-2 w-full md:w-auto items-center">
            <button onClick={toggleTheme} className={`hidden md:inline-block px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-700'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`${clsInput} border rounded-lg px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2 md:w-40 w-full`}/>
            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm w-full md:w-auto text-center whitespace-nowrap">Export (.CSV)</button>
            <button onClick={handleLogout} className="bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold px-3 py-2 rounded-lg w-full md:w-auto text-center whitespace-nowrap">Exit Profile</button>
          </div>
        </header>

        {/* Dynamic Targets Setup Section */}
        <section className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4`}>
          <div className="text-xs sm:text-sm w-full lg:w-auto">
            <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider mb-1.5">Target Management</span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-wrap text-slate-600 dark:text-slate-300">
              <div className="text-xs sm:text-sm">Week of: <strong className="text-blue-500 font-bold">{currentWeekMonday}</strong></div>
              <div className="hidden sm:block text-slate-400/60 text-xs">|</div>
              <div className="text-xs sm:text-sm">Active Goal: <strong className="text-sm sm:text-base font-black text-blue-500 whitespace-nowrap">{activeWeeklyTarget} kcal / day</strong></div>
            </div>
          </div>
          <form onSubmit={handleSetWeeklyTarget} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <input type="number" required min="0" placeholder="Set specific target for this week" value={weeklyTargetInput} onChange={(e) => setWeeklyTargetInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border text-xs rounded-lg px-3 py-2.5 focus:outline-none w-full lg:w-56`}/>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shrink-0 w-full sm:w-auto transition-colors">Lock Weekly Target</button>
          </form>
        </section>

        {/* Metrics Overview Layer Rows */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-between min-h-[130px]`}>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calorie Runway Balance</h2>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-black tracking-tight">{Math.round(totals.calories)}</span>
                <span className="text-xs font-semibold text-slate-400">/ {activeWeeklyTarget} kcal</span>
              </div>
            </div>
            <div>
              {calorieDiff === 0 ? (
                <div className="rounded-lg p-2.5 text-center text-xs font-bold bg-slate-500/10 text-slate-400">Target Exact Match</div>
              ) : !isOvershot ? (
                <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <span className="block text-[10px] uppercase font-bold tracking-wider opacity-80">Deficit Remaining</span>
                  <span className="text-sm font-extrabold tracking-tight">{Math.abs(Math.round(calorieDiff))} kcal</span>
                </div>
              ) : (
                <div className="rounded-lg p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500">
                  <span className="block text-[10px] uppercase font-bold tracking-wider opacity-80">Target Overshot By</span>
                  <span className="text-sm font-extrabold tracking-tight">{Math.round(calorieDiff)} kcal</span>
                </div>
              )}
            </div>
          </div>

          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm`}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Day Nutritional Breakdown</h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}><span className="block text-[10px] text-slate-400 font-medium">Protein</span><strong className="text-sm sm:text-base font-bold">{totals.protein.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}><span className="block text-[10px] text-slate-400 font-medium">Carbohydrates</span><strong className="text-sm sm:text-base font-bold">{totals.carbs.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}><span className="block text-[10px] text-slate-400 font-medium">Fats</span><strong className="text-sm sm:text-base font-bold">{totals.fat.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}><span className="block text-[10px] text-slate-400 font-medium">Fiber</span><strong className="text-sm sm:text-base font-bold">{totals.fiber.toFixed(1)}g</strong></div>
            </div>
          </div>

          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-center`}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Weight Log Tracker</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" min="0" placeholder="eg. 54.2" value={currentDayData.weight} onChange={(e) => updateProfileData({ weight: e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))) })} className={`${clsInput} border w-full text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}/>
              <span className="text-xs self-center font-bold text-slate-400 shrink-0">KG</span>
            </div>
          </div>
        </section>

        {/* Input Processors Forms Area & Tightly Linked Progress Habit Track Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm`}>
              <h3 className="text-sm font-bold mb-3 border-b border-slate-700/20 pb-2 uppercase tracking-wider text-slate-400">Log Meal Intake</h3>
              <form onSubmit={handleAddFood} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Time Window</label>
                  <select value={selectedMealTime} onChange={(e) => setSelectedMealTime(e.target.value as MealTime)} className={`${clsInput} border w-full text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500`}>
                    {mealTimes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Food Source</label>
                  <select value={selectedFoodIndex} onChange={(e) => setSelectedFoodIndex(Number(e.target.value))} className={`${clsInput} border w-full text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500`}>
                    {combinedFoodList.map((food, idx) => <option key={idx} value={idx}>{food.name} ({food.calories} kcal)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Servings / Multiplier</label>
                  <input type="number" step="0.1" min="0" value={servings} onChange={(e) => setServings(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500`}/>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors">Add To Log</button>
              </form>
            </div>

            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm`}>
              <h3 className="text-sm font-bold mb-3 border-b border-slate-700/20 pb-2 uppercase tracking-wider text-slate-400">Create Custom Food</h3>
              <form onSubmit={handleCreateCustomFood} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400">Food Description Name</label>
                  <input type="text" required placeholder="e.g. Rice Cakes" value={newFoodName} onChange={(e) => setNewFoodName(e.target.value)} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5 focus:ring-2 focus:ring-blue-500`}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400">Calories (kcal)</label>
                    <input type="number" min="0" value={newFoodCal} placeholder="0" onChange={(e) => setNewFoodCal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5`}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400">Protein (g)</label>
                    <input type="number" step="0.1" min="0" value={newFoodProt} placeholder="0" onChange={(e) => setNewFoodProt(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5`}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400">Carbs (g)</label>
                    <input type="number" step="0.1" min="0" value={newFoodCarb} placeholder="0" onChange={(e) => setNewFoodCarb(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5`}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400">Fat (g)</label>
                    <input type="number" step="0.1" min="0" value={newFoodFat} placeholder="0" onChange={(e) => setNewFoodFat(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5`}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-400">Fiber (g)</label>
                  <input type="number" step="0.1" min="0" value={newFoodFib} placeholder="0" onChange={(e) => setNewFoodFib(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-0.5`}/>
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded-lg border border-slate-700 mt-1 transition-colors">Save Global Custom Food</button>
              </form>
            </div>
          </div>

          {/* Right Main Columns: Connected Gamified Habits Tracking Workspace */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            
            {/* Gamified Habit Workspace Module with Infinite Matrix Scanline Aura (100% complete) */}
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm transition-all duration-300 ${is100Percent ? 'animate-cyber-complete border-cyan-500' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-700/20 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Daily Discipline Track</h3>
                  <p className="text-[11px] font-bold mt-0.5 text-cyan-500 dark:text-cyan-400">
                    {is100Percent ? '⚡ CRITICAL CORE SYNC COMPLETE' : `${completedHabitsCount} / ${totalHabitsCount} Target Units Operational`}
                  </p>
                </div>

                {/* SVG Progress Ring */}
                <div className="relative w-12 h-12">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="transparent" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="3.5" />
                    <circle cx="20" cy="20" r="18" fill="transparent" stroke={is100Percent ? '#06b6d4' : '#10b981'} strokeWidth="3.5" 
                      strokeDasharray="113.09" strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-300"
                    />
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-tight transition-transform ${is100Percent ? 'scale-110 text-cyan-400' : ''}`}>
                    {habitPercentage}%
                  </div>
                </div>
              </div>

              {/* Task Tracker Blocks */}
              {totalHabitsCount === 0 ? (
                <p className="text-xs text-slate-400 italic">No discipline check tracks configured inside workspace.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {activeHabitsList.map((habit) => {
                    const isChecked = !!dayHabitsState[habit];
                    const isPopping = quantumTriggerHabit === habit;
                    
                    return (
                      <div 
                        key={habit}
                        className={`flex items-center justify-between gap-1 rounded-xl border transition-all duration-150 ${
                          isPopping ? 'animate-quantum-hit' : ''
                        } ${
                          isChecked 
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-800 dark:text-emerald-400 shadow-sm' 
                            : 'bg-transparent border-slate-700/10 text-slate-400 dark:border-slate-800 hover:border-slate-500/20'
                        }`}
                      >
                        {/* Toggle Check Trigger Frame */}
                        <button
                          type="button"
                          onClick={() => handleToggleHabit(habit)}
                          className="flex items-center gap-3 text-left text-xs p-3 flex-1 min-w-0"
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[9px] font-black shrink-0 transition-all ${
                            isChecked ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-105' : 'border-slate-400'
                          }`}>
                            {isChecked && '✓'}
                          </div>
                          <span className={`truncate font-medium ${isChecked ? 'line-through opacity-60' : ''}`}>{habit}</span>
                        </button>

                        {/* Isolated Habit Destruction Node */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomHabit(habit)}
                          className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-3 text-xs font-bold transition-colors shrink-0"
                          title="Purge track asset"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Habit Injection Substation */}
              <form onSubmit={handleCreateCustomHabit} className="flex gap-2 border-t border-slate-700/10 pt-3 mt-2">
                <input 
                  type="text" required placeholder="➕ Add custom tracking habit (e.g. 8h Sleep)" value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className={`${clsInput} border text-xs rounded-lg px-3 py-2.5 focus:outline-none w-full`}
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shrink-0">
                  Inject Track
                </button>
              </form>
            </div>

            {/* Timelines Intake Panel Logs Layout */}
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl shadow-sm`}>
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-slate-400">Daily Meal Records Timeline</h3>
              {mealTimes.map(timeWindow => {
                const mealsInWindow = currentDayData.meals.filter(m => m.mealTime === timeWindow);
                return (
                  <div key={timeWindow} className="mb-5 last:mb-0 border-b border-slate-700/20 last:border-0 pb-4 last:pb-0">
                    <h4 className="text-xs font-bold text-blue-500 bg-blue-500/10 inline-block px-2.5 py-0.5 rounded-md mb-2">{timeWindow}</h4>
                    {mealsInWindow.length === 0 ? <p className="text-xs text-slate-400 italic pl-1">No data logged for this window.</p> : (
                      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                        <table className="w-full text-left text-xs min-w-[420px]">
                          <thead>
                            <tr className="border-b border-slate-700/20 text-slate-400 uppercase font-semibold text-[10px]">
                              <th className="py-2 pr-2">Item</th>
                              <th className="py-2 px-2 text-center">Qty</th>
                              <th className="py-2 px-2 text-right">Calories</th>
                              <th className="py-2 px-2 text-right">P / C / F / Fib</th>
                              <th className="py-2 pl-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mealsInWindow.map(item => (
                              <tr key={item.id} className="border-b border-slate-700/10 hover:bg-slate-500/5 transition-colors">
                                <td className="py-2.5 pr-2 font-medium max-w-[140px] truncate">{item.name}</td>
                                <td className="py-2.5 px-2 text-center font-bold"><span className="bg-slate-500/10 px-1.5 py-0.5 rounded text-[11px]">{item.servings}x</span></td>
                                <td className="py-2.5 px-2 text-right font-semibold">{Math.round(item.calories * item.servings)} kcal</td>
                                <td className="py-2.5 px-2 text-right tracking-tight text-slate-400">{(item.protein * item.servings).toFixed(1)}g / {(item.carbs * item.servings).toFixed(1)}g / {(item.fat * item.servings).toFixed(1)}g / {(item.fiber * item.servings).toFixed(1)}g</td>
                                <td className="py-2.5 pl-2 text-right"><button type="button" onClick={() => handleDeleteLoggedFood(item.id)} className="text-rose-500 hover:text-rose-400 font-bold px-1.5 text-sm">✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </section>
      </main>
    </div>
  );
}