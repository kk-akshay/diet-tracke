// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FIXED_FOODS } from '../data/fixedFoods';
import { FoodItem, MealTime, LoggedFood, DayLog, UserProfileData, MultiUserStorage } from '../types/diet';

const INITIAL_DAY_LOG = (): DayLog => ({
  weight: '',
  meals: [],
  habits: { walk: false, exercise: false, sugarCut: false }
});

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

  // Auth Toggle Switch ('signin' or 'signup')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loginUsername, setLoginUsername] = useState('');
  const [regUsername, setRegUsername] = useState('');
  
  // Numeric Inputs allow string empty state to fix standard clearing behavior
  const [regDefaultTarget, setRegDefaultTarget] = useState<number | ''>(2500);

  // Dashboard Inputs State
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime>('Breakfast');
  const [selectedFoodIndex, setSelectedFoodIndex] = useState<number>(0);
  const [servings, setServings] = useState<number | ''>(1);
  const [weeklyTargetInput, setWeeklyTargetInput] = useState<number | ''>('');

  // Custom Ingredient Creator State (Uses string empty state to clear zeros properly)
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCal, setNewFoodCal] = useState<number | ''>('');
  const [newFoodProt, setNewFoodProt] = useState<number | ''>('');
  const [newFoodCarb, setNewFoodCarb] = useState<number | ''>('');
  const [newFoodFat, setNewFoodFat] = useState<number | ''>('');
  const [newFoodFib, setNewFoodFib] = useState<number | ''>('');

  // Initialization & Hydration Layer
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    
    const savedDb = localStorage.getItem('macrosync_multi_db');
    const savedCustom = localStorage.getItem('macrosync_custom_foods');
    const savedTheme = localStorage.getItem('macrosync_theme');
    const savedSession = localStorage.getItem('macrosync_active_session');

    if (savedDb) setDb(JSON.parse(savedDb));
    if (savedCustom) setCustomFoods(JSON.parse(savedCustom));
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
    if (savedSession) setCurrentUser(savedSession);

    setMounted(true);
  }, []);

  // Sync mutations cleanly to client local storage
  useEffect(() => {
    if (mounted) localStorage.setItem('macrosync_multi_db', JSON.stringify(db));
  }, [db, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('macrosync_custom_foods', JSON.stringify(customFoods));
  }, [customFoods, mounted]);

  // Auth Operations
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regUsername.trim().toLowerCase();
    if (!cleanName) return;
    if (db[cleanName]) {
      alert('Username configuration already allocated.');
      return;
    }

    const cleanTarget = regDefaultTarget === '' ? 2000 : Math.max(0, regDefaultTarget);

    const newProfile: UserProfileData = {
      username: cleanName,
      defaultTarget: cleanTarget,
      weeklyTargets: {},
      logs: {}
    };

    setDb(prev => ({ ...prev, [cleanName]: newProfile }));
    setCurrentUser(cleanName);
    localStorage.setItem('macrosync_active_session', cleanName);
    setRegUsername('');
    setRegDefaultTarget(2500);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = loginUsername.trim().toLowerCase();
    if (db[cleanName]) {
      setCurrentUser(cleanName);
      localStorage.setItem('macrosync_active_session', cleanName);
      setLoginUsername('');
    } else {
      alert('Profile context signature not found.');
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

  if (!mounted) return <div className="p-8 text-center text-slate-500">Initializing Database Isolation...</div>;

  // Render Modern Login / Sign Up Gate if no active workspace session exists
  if (!currentUser || !db[currentUser]) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          {/* Header Branding Row */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">Macros daily</h1>
              <p className="text-xs text-slate-400 mt-0.5">Nutritional Profile Workspaces</p>
            </div>
            <button onClick={toggleTheme} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-600'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          {/* Tab Navigation Controls */}
          <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-slate-500/10 border border-slate-500/5">
            <button 
              onClick={() => setAuthMode('signin')}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'signin' ? (isDarkMode ? 'bg-slate-800 text-white shadow' : 'bg-white text-blue-600 shadow') : 'text-slate-400'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'signup' ? (isDarkMode ? 'bg-slate-800 text-white shadow' : 'bg-white text-emerald-600 shadow') : 'text-slate-400'}`}
            >
              Sign Up
            </button>
          </div>

          {/* Conditional Input Segment Render Engine */}
          {authMode === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Registered Username</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. akshay"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className={`w-full text-sm rounded-lg p-2.5 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-500/10">
                Access Workspace →
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">New Profile Username</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. akshay"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className={`w-full text-sm rounded-lg p-2.5 border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Standard Daily Calories Target</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  placeholder="e.g. 2800"
                  value={regDefaultTarget}
                  onChange={(e) => setRegDefaultTarget(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                  className={`w-full text-sm rounded-lg p-2.5 border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-500/10">
                Provision Profile Space ✓
              </button>
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

  // Dynamic Multi-User Modifier Mutation Layer
  const updateProfileData = (updatedLog: Partial<DayLog>) => {
    const freshLogs = { ...userProfile.logs, [selectedDate]: { ...currentDayData, ...updatedLog } };
    setDb(prev => ({
      ...prev,
      [currentUser]: { ...userProfile, logs: freshLogs }
    }));
  };

  const handleSetWeeklyTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = weeklyTargetInput === '' ? 0 : Math.max(0, weeklyTargetInput);
    if (cleanTarget <= 0) return;

    setDb(prev => ({
      ...prev,
      [currentUser]: {
        ...userProfile,
        weeklyTargets: { ...userProfile.weeklyTargets, [currentWeekMonday]: cleanTarget }
      }
    }));
    setWeeklyTargetInput('');
    alert(`Target for week of ${currentWeekMonday} set to ${cleanTarget} kcal.`);
  };

  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    const sourceFood = combinedFoodList[selectedFoodIndex];
    const cleanServings = servings === '' ? 1 : Math.max(0, servings);
    if (!sourceFood || cleanServings <= 0) return;

    const loggedItem: LoggedFood = {
      ...sourceFood,
      id: crypto.randomUUID(),
      servings: cleanServings,
      mealTime: selectedMealTime
    };

    updateProfileData({ meals: [...currentDayData.meals, loggedItem] });
    setServings(1);
  };

  const handleCreateCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    const newCustomFood: FoodItem = {
      name: newFoodName,
      calories: newFoodCal === '' ? 0 : Math.max(0, newFoodCal),
      protein: newFoodProt === '' ? 0 : Math.max(0, newFoodProt),
      carbs: newFoodCarb === '' ? 0 : Math.max(0, newFoodCarb),
      fat: newFoodFat === '' ? 0 : Math.max(0, newFoodFat),
      fiber: newFoodFib === '' ? 0 : Math.max(0, newFoodFib)
    };

    setCustomFoods(prev => [...prev, newCustomFood]);
    
    // Reset local states to empty strings cleanly
    setNewFoodName('');
    setNewFoodCal('');
    setNewFoodProt('');
    setNewFoodCarb('');
    setNewFoodFat('');
    setNewFoodFib('');
    alert(`"${newCustomFood.name}" appended dynamically to food choices.`);
  };

  const handleDeleteLoggedFood = (id: string) => {
    updateProfileData({ meals: currentDayData.meals.filter(m => m.id !== id) });
  };

  // Computations
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

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Week Block,Logged Weight,Meal Time,Food Name,Servings,Total Calories,Protein(g),Carbs(g),Fat(g),Fiber(g),Walk Metric,Exercise Metric,Sugar Cut\n";

    Object.keys(userProfile.logs).sort().forEach(dateKey => {
      const logItem = userProfile.logs[dateKey];
      const mon = getWeekMonday(dateKey);
      const w = logItem.weight || 'N/A';
      const hWalk = logItem.habits.walk ? 'Yes' : 'No';
      const hEx = logItem.habits.exercise ? 'Yes' : 'No';
      const hSug = logItem.habits.sugarCut ? 'Yes' : 'No';

      if (logItem.meals.length === 0) {
        csvContent += `${dateKey},${mon},${w},None,No Logged Intake,0,0,0,0,0,0,${hWalk},${hEx},${hSug}\n`;
      } else {
        logItem.meals.forEach(m => {
          csvContent += `${dateKey},${mon},${w},${m.mealTime},"${m.name}",${m.servings},${m.calories * m.servings},${m.protein * m.servings},${m.carbs * m.servings},${m.fat * m.servings},${m.fiber * m.servings},${hWalk},${hEx},${hSug}\n`;
        });
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${userProfile.username}_diet_logs_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mealTimes: MealTime[] = ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner'];

  const clsBg = isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const clsCard = isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const clsInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-black placeholder-slate-400';
  const clsSubBg = isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100';

  return (
    <div className={`min-h-screen ${clsBg} transition-colors duration-150 pb-12`}>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Core Workspace Header Context */}
        <header className={`${clsCard} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 justify-between items-center`}>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">Macros daily</h1>
            <p className="text-xs text-blue-500 font-medium">Domain Space Account: <span className="uppercase font-bold">{userProfile.username}</span></p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={toggleTheme} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-slate-700'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>

            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className={`${clsInput} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />

            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
              Export Individual Log (.CSV)
            </button>

            <button onClick={handleLogout} className="bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
              Exit Profile
            </button>
          </div>
        </header>

        {/* Dynamic Targets Setup Section */}
        <section className={`${clsCard} border p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4`}>
          <div className="text-sm">
            <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">Target Management</span>
            Active Calorie configuration for week of <strong className="text-blue-500">{currentWeekMonday}</strong>: <strong className="text-base">{activeWeeklyTarget} kcal / day</strong>
          </div>
          <form onSubmit={handleSetWeeklyTarget} className="flex gap-2 w-full sm:w-auto">
            <input 
              type="number" 
              required
              min="0"
              placeholder="Set specific target for this week"
              value={weeklyTargetInput}
              onChange={(e) => setWeeklyTargetInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              className={`${clsInput} border text-xs rounded-lg px-3 py-2 focus:outline-none w-full sm:w-56`}
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shrink-0 whitespace-nowrap">
              Lock Weekly Target
            </button>
          </form>
        </section>

        {/* Display Panel Layout rows */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className={`${clsCard} border p-5 rounded-xl shadow-sm flex flex-col justify-between`}>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Calorie Runway Balance</h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{Math.round(totals.calories)}</span>
                <span className="text-sm font-medium text-slate-400">/ {activeWeeklyTarget} kcal</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700/20">
              {calorieDiff === 0 ? (
                <span className="text-sm font-medium text-slate-400">Goal matched exactly.</span>
              ) : !isOvershot ? (
                <div className="text-sm font-medium text-amber-500">
                  Deficit Remaining: <strong className="font-bold">{Math.abs(Math.round(calorieDiff))} kcal</strong> to match goal
                </div>
              ) : (
                <div className="text-sm font-medium text-rose-500">
                  Overshot Target Margin: <strong className="font-bold">{Math.round(calorieDiff)} kcal</strong>
                </div>
              )}
            </div>
          </div>

          <div className={`${clsCard} border p-5 rounded-xl shadow-sm`}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Day Nutritional Breakdown</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Protein</span>
                <strong className="text-base">{totals.protein.toFixed(1)}g</strong>
              </div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Carbohydrates</span>
                <strong className="text-base">{totals.carbs.toFixed(1)}g</strong>
              </div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Fats</span>
                <strong className="text-base">{totals.fat.toFixed(1)}g</strong>
              </div>
              <div className={`${clsSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Fiber</span>
                <strong className="text-base">{totals.fiber.toFixed(1)}g</strong>
              </div>
            </div>
          </div>

          <div className={`${clsCard} border p-5 rounded-xl shadow-sm space-y-4`}>
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-1">Weight Log Tracker</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  placeholder="eg. 54.2"
                  value={currentDayData.weight}
                  onChange={(e) => updateProfileData({ weight: e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))) })}
                  className={`${clsInput} border w-full text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <span className="text-sm self-center font-bold text-slate-400">KG</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/20">
              <span className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Metrics Habit Checklist</span>
              <div className="flex flex-col gap-2">
                {Object.keys(currentDayData.habits).map((key) => {
                  const habitKey = key as keyof typeof currentDayData.habits;
                  const labels: Record<string, string> = { walk: 'Daily Walk Completed', exercise: 'Exercise Logged', sugarCut: 'Strict Sugar Cut Followed' };
                  return (
                    <label key={habitKey} className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={currentDayData.habits[habitKey]}
                        onChange={(e) => updateProfileData({
                          habits: { ...currentDayData.habits, [habitKey]: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {labels[habitKey]}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

        </section>

        {/* Workstation Processing Layout Tables */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1 space-y-6">
            
            {/* Log Food Window */}
            <div className={`${clsCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4 border-b border-slate-700/20 pb-2">Log Meal Intake</h3>
              <form onSubmit={handleAddFood} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select Time Window</label>
                  <select 
                    value={selectedMealTime} 
                    onChange={(e) => setSelectedMealTime(e.target.value as MealTime)}
                    className={`${clsInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  >
                    {mealTimes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select Food Source</label>
                  <select 
                    value={selectedFoodIndex} 
                    onChange={(e) => setSelectedFoodIndex(Number(e.target.value))}
                    className={`${clsInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  >
                    {combinedFoodList.map((food, idx) => (
                      <option key={idx} value={idx}>
                        {food.name} ({food.calories} kcal)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Servings / Multiplier</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={servings} 
                    onChange={(e) => setServings(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className={`${clsInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg transition-colors shadow-sm">
                  Add To Log
                </button>
              </form>
            </div>

            {/* Custom Asset Config Generator */}
            <div className={`${clsCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4 border-b border-slate-700/20 pb-2">Create Custom Food Type</h3>
              <form onSubmit={handleCreateCustomFood} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400">Food Description Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Rice Cakes"
                    value={newFoodName} 
                    onChange={(e) => setNewFoodName(e.target.value)}
                    className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5 focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400">Calories (kcal)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={newFoodCal} 
                      placeholder="0"
                      onChange={(e) => setNewFoodCal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400">Protein (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFoodProt} 
                      placeholder="0"
                      onChange={(e) => setNewFoodProt(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400">Carbs (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFoodCarb} 
                      placeholder="0"
                      onChange={(e) => setNewFoodCarb(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400">Fat (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFoodFat} 
                      placeholder="0"
                      onChange={(e) => setNewFoodFat(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400">Fiber (g)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={newFoodFib} 
                    placeholder="0"
                    onChange={(e) => setNewFoodFib(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className={`${clsInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                  />
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg border border-slate-700 mt-2 transition-colors">
                  Save Global Custom Food
                </button>
              </form>
            </div>

          </div>

          {/* Active Intake Timeline Tracking Matrix */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`${clsCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4">Daily Meal Records Timeline</h3>
              
              {mealTimes.map(timeWindow => {
                const mealsInWindow = currentDayData.meals.filter(m => m.mealTime === timeWindow);
                return (
                  <div key={timeWindow} className="mb-6 last:mb-0 border-b border-slate-700/20 last:border-0 pb-4 last:pb-0">
                    <h4 className="text-sm font-bold text-blue-500 bg-blue-500/10 inline-block px-2.5 py-0.5 rounded-md mb-2">
                      {timeWindow}
                    </h4>
                    
                    {mealsInWindow.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-1">No data logged for this meal track window.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-700/20 text-slate-400 uppercase font-semibold">
                              <th className="py-2">Item</th>
                              <th className="py-2 text-center">Qty</th>
                              <th className="py-2 text-right">Calories</th>
                              <th className="py-2 text-right">P / C / F / Fib</th>
                              <th className="py-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mealsInWindow.map(item => (
                              <tr key={item.id} className="border-b border-slate-700/10 hover:bg-slate-500/5 transition-colors">
                                <td className="py-2 font-medium">{item.name}</td>
                                <td className="py-2 text-center font-bold bg-slate-500/10 rounded">{item.servings}x</td>
                                <td className="py-2 text-right font-semibold">{Math.round(item.calories * item.servings)} kcal</td>
                                <td className="py-2 text-right tracking-tight text-slate-400">
                                  {(item.protein * item.servings).toFixed(1)}g / {(item.carbs * item.servings).toFixed(1)}g / {(item.fat * item.servings).toFixed(1)}g / {(item.fiber * item.servings).toFixed(1)}g
                                </td>
                                <td className="py-2 text-right">
                                  <button 
                                    onClick={() => handleDeleteLoggedFood(item.id)}
                                    className="text-rose-500 hover:text-rose-400 font-bold px-1"
                                  >
                                    ✕
                                  </button>
                                </td>
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