// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FIXED_FOODS } from '../data/fixedFoods';
import { supabase } from '../utils/supabase';
import { FoodItem, MealTime, LoggedFood, DayLog, UserProfileData, MultiUserStorage } from '../types/diet';

// Immutable static configuration assets defined outside the main component context loop
const MEAL_TIMES: MealTime[] = ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner'];

const DEFAULT_HABITS = [
  '🏃‍♂️ 10k Steps Walk',
  '💪 Workout Session',
  '🚫 No Added Sugar'
];

const INITIAL_DAY_LOG = (): DayLog => ({
  weight: '65.0', 
  meals: [],
  habits: {}
});

function getWeekMonday(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// YYYY-MM key used to group logs into calendar months
function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function MultiUserDietTracker() {
  // ==========================================
  // 1. COMPONENT REACT STATES (Initialized First)
  // ==========================================
  const [db, setDb] = useState<MultiUserStorage>({});
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'history' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regDefaultTarget, setRegDefaultTarget] = useState<number | ''>(2500);

  // customFoods now lives on the cloud profile (userProfile.customFoods) so it
  // follows the user across devices instead of being stuck in this browser's localStorage.
  const [migratingLocalFoods, setMigratingLocalFoods] = useState<boolean>(false);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime>('Breakfast');
  const [selectedFoodIndex, setSelectedFoodIndex] = useState<number>(0);
  
  // Clean baseline application standard defaults
  const [servings, setServings] = useState<number | ''>(1);
  const [weeklyTargetInput, setWeeklyTargetInput] = useState<number | ''>(3000);

  const [newHabitName, setNewHabitName] = useState('');
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCal, setNewFoodCal] = useState<number | ''>(0);
  const [newFoodProt, setNewFoodProt] = useState<number | ''>(0);
  const [newFoodCarb, setNewFoodCarb] = useState<number | ''>(0);
  const [newFoodFat, setNewFoodFat] = useState<number | ''>(0);
  const [newFoodFib, setNewFoodFib] = useState<number | ''>(0);

  const [lastCheckedHabit, setLastCheckedHabit] = useState<string | null>(null);
  const [showConfettiEffect, setShowConfettiEffect] = useState<boolean>(false);

  // ==========================================
  // 2. CORE ACTION CONTROLLERS (Hoisted to Top)
  // ==========================================
  async function fetchCloudProfile(username: string) {
    const { data, error } = await supabase
      .from('macros_daily_users')
      .select('profile_data')
      .eq('username', username)
      .single();

    if (data && !error) {
      setDb(prev => ({ ...prev, [username]: data.profile_data }));
    }
  }

  function toggleTheme() {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('macrosync_theme', nextTheme ? 'dark' : 'light');
  }

  function updateProfileData(updatedLog: Partial<DayLog>) {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const currentDayLog = currentProfile.logs[selectedDate] || INITIAL_DAY_LOG();
    const freshLogs = { ...currentProfile.logs, [selectedDate]: { ...currentDayLog, ...updatedLog } };
    setDb(prev => ({ ...prev, [currentUser]: { ...currentProfile, logs: freshLogs } }));
  }

  async function handleRegister(e: React.FormEvent) {
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
      customFoods: [],
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
      alert('This username is already taken.');
    }
  }

  async function handleLogin(e: React.FormEvent) {
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
        alert('Incorrect security PIN.');
      }
    } else {
      alert('User profile not found.');
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setShowSettings(false);
    setShowMenu(false);
    localStorage.removeItem('macrosync_active_session');
  }

  function handleCreateCustomHabit(e: React.FormEvent) {
    e.preventDefault();
    const cleanHabit = newHabitName.trim();
    if (!cleanHabit || !currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const currentHabits = currentProfile.habitsList || [...DEFAULT_HABITS];
    
    if (currentHabits.includes(cleanHabit)) {
      alert('This habit is already in your list.');
      return;
    }

    setDb(prev => ({
      ...prev,
      [currentUser]: { ...currentProfile, habitsList: [...currentHabits, cleanHabit] }
    }));
    setNewHabitName('');
  }

  function handleDeleteCustomHabit(habitName: string) {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const currentHabits = currentProfile.habitsList || [...DEFAULT_HABITS];
    const currentDayLog = currentProfile.logs[selectedDate] || INITIAL_DAY_LOG();
    
    const updatedHabitList = currentHabits.filter(h => h !== habitName);
    const freshDayHabits = { ...currentDayLog.habits };
    delete freshDayHabits[habitName];

    const freshLogs = { ...currentProfile.logs, [selectedDate]: { ...currentDayLog, habits: freshDayHabits } };
    setDb(prev => ({ ...prev, [currentUser]: { ...currentProfile, habitsList: updatedHabitList, logs: freshLogs } }));
  }

  function handleToggleHabit(habitName: string) {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const currentDayLog = currentProfile.logs[selectedDate] || INITIAL_DAY_LOG();
    const currentHabitsState = currentDayLog.habits || {};
    
    const nextStatus = !currentHabitsState[habitName];
    setLastCheckedHabit(habitName);
    
    // Trigger localized dynamic state check logic
    const activeHabits = currentProfile.habitsList || [...DEFAULT_HABITS];
    const checkedCountAfterToggle = activeHabits.filter(h => h === habitName ? nextStatus : currentHabitsState[h]).length;
    
    if (nextStatus && checkedCountAfterToggle === activeHabits.length) {
      setShowConfettiEffect(true);
      setTimeout(() => setShowConfettiEffect(false), 2500);
    }

    setTimeout(() => setLastCheckedHabit(null), 400);
    const freshHabits = { ...currentHabitsState, [habitName]: nextStatus };
    updateProfileData({ habits: freshHabits });
  }

  function handleSetWeeklyTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const targetFloor = weeklyTargetInput === '' ? 0 : Math.max(0, weeklyTargetInput);
    if (targetFloor <= 0) return;
    setDb(prev => ({
      ...prev,
      [currentUser]: { ...currentProfile, weeklyTargets: { ...currentProfile.weeklyTargets, [currentWeekMonday]: targetFloor } }
    }));
    setWeeklyTargetInput('');
  }

  function handleAddFood(e: React.FormEvent) {
    e.preventDefault();
    const sourceFood = combinedFoodList[selectedFoodIndex];
    const cleanServings = servings === '' ? 1 : Math.max(0, servings);
    if (!sourceFood || cleanServings <= 0) return;

    const loggedItem: LoggedFood = { ...sourceFood, id: crypto.randomUUID(), servings: cleanServings, mealTime: selectedMealTime };
    const currentProfile = db[currentUser!];
    const currentDayLog = currentProfile?.logs[selectedDate] || INITIAL_DAY_LOG();
    updateProfileData({ meals: [...(currentDayLog.meals || []), loggedItem] });
    setServings(1);
  }

  function handleCreateCustomFood(e: React.FormEvent) {
    e.preventDefault();
    if (!newFoodName.trim() || !currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const existingCustomFoods = currentProfile.customFoods || [];

    const customFoodAsset: FoodItem = {
      name: newFoodName,
      calories: newFoodCal === '' ? 0 : Math.max(0, newFoodCal),
      protein: newFoodProt === '' ? 0 : Math.max(0, newFoodProt),
      carbs: newFoodCarb === '' ? 0 : Math.max(0, newFoodCarb),
      fat: newFoodFat === '' ? 0 : Math.max(0, newFoodFat),
      fiber: newFoodFib === '' ? 0 : Math.max(0, newFoodFib)
    };

    setDb(prev => ({
      ...prev,
      [currentUser]: { ...currentProfile, customFoods: [...existingCustomFoods, customFoodAsset] }
    }));
    setNewFoodName(''); setNewFoodCal(0); setNewFoodProt(0); setNewFoodCarb(0); setNewFoodFat(0); setNewFoodFib(0);
    alert(`"${customFoodAsset.name}" has been added to your account and will sync to all your devices.`);
  }

  function handleDeleteCustomFood(index: number) {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const existingCustomFoods = currentProfile.customFoods || [];
    const updatedCustomFoods = existingCustomFoods.filter((_, i) => i !== index);
    setDb(prev => ({ ...prev, [currentUser]: { ...currentProfile, customFoods: updatedCustomFoods } }));
    // Keep the currently selected dropdown food item pointing somewhere valid
    setSelectedFoodIndex(0);
  }

  function handleDeleteLoggedFood(id: string) {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    const currentDayLog = currentProfile.logs[selectedDate] || INITIAL_DAY_LOG();
    updateProfileData({ meals: (currentDayLog.meals || []).filter(m => m.id !== id) });
  }

  function handleExportCSV() {
    if (!currentUser || !db[currentUser]) return;
    const currentProfile = db[currentUser];
    let csvContent = "data:text/csv;charset=utf-8,Date,Week Block,Logged Weight,Meal Time,Food Name,Servings,Total Calories,Protein(g),Carbs(g),Fat(g),Fiber(g)\n";
    Object.keys(currentProfile.logs).sort().forEach(dateKey => {
      const logItem = currentProfile.logs[dateKey];
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
    link.setAttribute("download", `${currentProfile.username}_diet_logs_${selectedDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  // ==========================================
  // 3. EXTRACTED DATA & MATHEMATICS (Safe Layer)
  // ==========================================
  const userProfile: UserProfileData | undefined = currentUser ? db[currentUser] : undefined;
  const currentWeekMonday = getWeekMonday(selectedDate);
  const activeWeeklyTarget = userProfile ? (userProfile.weeklyTargets[currentWeekMonday] || userProfile.defaultTarget) : 2500;
  const currentDayData: DayLog = (userProfile && userProfile.logs[selectedDate]) ? userProfile.logs[selectedDate] : INITIAL_DAY_LOG();
  const combinedFoodList = [...FIXED_FOODS, ...(userProfile?.customFoods || [])];
  const activeHabitsList = userProfile?.habitsList || [...DEFAULT_HABITS];
  const dayHabitsState = currentDayData.habits || {};

  const totals = (currentDayData.meals || []).reduce((acc, item) => {
    acc.calories += item.calories * item.servings;
    acc.protein += item.protein * item.servings;
    acc.carbs += item.carbs * item.servings;
    acc.fat += item.fat * item.servings;
    acc.fiber += item.fiber * item.servings;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const calorieDiff = totals.calories - activeWeeklyTarget;
  const isOvershot = calorieDiff > 0;
  const isGoalReached = Math.round(totals.calories) >= activeWeeklyTarget;

  const totalHabitsCount = activeHabitsList.length;
  const completedHabitsCount = activeHabitsList.filter(h => dayHabitsState[h]).length;
  const habitPercentage = totalHabitsCount > 0 ? Math.round((completedHabitsCount / totalHabitsCount) * 100) : 0;
  const is100Percent = habitPercentage === 100;
  const strokeDashoffset = totalHabitsCount > 0 ? 113.09 - (113.09 * completedHabitsCount) / totalHabitsCount : 113.09;

  // Knob/Thumb position angles on progress circle (Calculated for rotated coordinate framework space)
  const angleRadians = (habitPercentage / 100) * 2 * Math.PI;
  const targetIndicatorX = 20 + 18 * Math.cos(angleRadians);
  const targetIndicatorY = 20 + 18 * Math.sin(angleRadians);

  // Dynamic progress circle colors mapping precisely to the custom design asset requirements
  const circleTrackColor = isDarkMode ? '#1e222b' : '#e2e8f0';
  const circleProgressColor = is100Percent 
    ? (isDarkMode ? '#a78bfa' : '#6366f1') 
    : (isDarkMode ? '#b4b6f9' : '#818cf8');

  // ==========================================
  // 3b. HISTORY VIEW (all logged dates, newest first)
  // ==========================================
  type HistoryRow = {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    weight: string;
    mealsCount: number;
    habitPct: number;
    target: number;
  };

  const historyRows: HistoryRow[] = userProfile
    ? Object.keys(userProfile.logs)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((dateKey) => {
          const log = userProfile.logs[dateKey];
          const dayTotals = (log.meals || []).reduce((acc, item) => {
            acc.calories += item.calories * item.servings;
            acc.protein += item.protein * item.servings;
            acc.carbs += item.carbs * item.servings;
            acc.fat += item.fat * item.servings;
            acc.fiber += item.fiber * item.servings;
            return acc;
          }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
          const habitsForDay = userProfile.habitsList || DEFAULT_HABITS;
          const dayHabits = log.habits || {};
          const doneCount = habitsForDay.filter(h => dayHabits[h]).length;
          const pct = habitsForDay.length > 0 ? Math.round((doneCount / habitsForDay.length) * 100) : 0;
          return {
            date: dateKey,
            calories: dayTotals.calories,
            protein: dayTotals.protein,
            carbs: dayTotals.carbs,
            fat: dayTotals.fat,
            fiber: dayTotals.fiber,
            weight: log.weight,
            mealsCount: (log.meals || []).length,
            habitPct: pct,
            target: userProfile.weeklyTargets[getWeekMonday(dateKey)] || userProfile.defaultTarget,
          };
        })
    : [];

  const filteredHistoryRows = historySearch.trim()
    ? historyRows.filter(r => r.date.includes(historySearch.trim()))
    : historyRows;

  // ==========================================
  // 3c. MONTHLY ANALYSIS (aggregates for selectedMonth)
  // ==========================================
  const monthRows = historyRows
    .filter(r => getMonthKey(r.date) === selectedMonth)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const daysLoggedInMonth = monthRows.length;
  const monthAvg = (key: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber') =>
    daysLoggedInMonth > 0 ? monthRows.reduce((sum, r) => sum + r[key], 0) / daysLoggedInMonth : 0;

  const monthAvgCalories = monthAvg('calories');
  const monthAvgProtein = monthAvg('protein');
  const monthAvgCarbs = monthAvg('carbs');
  const monthAvgFat = monthAvg('fat');
  const monthAvgFiber = monthAvg('fiber');

  const monthAvgHabitPct = daysLoggedInMonth > 0
    ? Math.round(monthRows.reduce((sum, r) => sum + r.habitPct, 0) / daysLoggedInMonth)
    : 0;

  const daysOnTarget = monthRows.filter(r => r.target > 0 && r.calories <= r.target).length;
  const adherencePct = daysLoggedInMonth > 0 ? Math.round((daysOnTarget / daysLoggedInMonth) * 100) : 0;

  const monthWeights = monthRows
    .map(r => ({ date: r.date, weight: parseFloat(r.weight) }))
    .filter(w => !isNaN(w.weight) && w.weight > 0);
  const startWeight = monthWeights.length > 0 ? monthWeights[0].weight : null;
  const endWeight = monthWeights.length > 0 ? monthWeights[monthWeights.length - 1].weight : null;
  const weightDelta = startWeight !== null && endWeight !== null ? endWeight - startWeight : null;

  const highestCalorieDay = monthRows.length > 0
    ? monthRows.reduce((a, b) => (b.calories > a.calories ? b : a))
    : null;
  const lowestCalorieDay = monthRows.length > 0
    ? monthRows.reduce((a, b) => (b.calories < a.calories ? b : a))
    : null;

  const monthChartMax = Math.max(
    monthAvgCalories > 0 ? monthAvgCalories : 0,
    ...monthRows.map(r => r.calories),
    ...monthRows.map(r => r.target),
    1
  );

  // ==========================================
  // 4. DATA SYNCHRONIZATION LIFECYCLES
  // ==========================================
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDate(todayStr);
    setSelectedMonth(getMonthKey(todayStr));
    const savedTheme = localStorage.getItem('macrosync_theme');
    const savedSession = localStorage.getItem('macrosync_active_session');

    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
    
    if (savedSession) {
      setCurrentUser(savedSession);
      fetchCloudProfile(savedSession);
    }
    setMounted(true);
  }, []);

  // One-time migration: older versions of this app stored custom foods in this
  // browser's localStorage only. Once the cloud profile has loaded, pull any
  // leftover local foods into the account so they sync across devices, then
  // clear the local copy so this only ever runs once per browser.
  useEffect(() => {
    if (!mounted || !currentUser || !db[currentUser] || migratingLocalFoods) return;
    const legacyRaw = localStorage.getItem('macrosync_custom_foods');
    if (!legacyRaw) return;

    try {
      const legacyFoods: FoodItem[] = JSON.parse(legacyRaw);
      if (Array.isArray(legacyFoods) && legacyFoods.length > 0) {
        setMigratingLocalFoods(true);
        const currentProfile = db[currentUser];
        const existingNames = new Set((currentProfile.customFoods || []).map(f => f.name));
        const newOnes = legacyFoods.filter(f => !existingNames.has(f.name));
        if (newOnes.length > 0) {
          setDb(prev => ({
            ...prev,
            [currentUser]: { ...currentProfile, customFoods: [...(currentProfile.customFoods || []), ...newOnes] }
          }));
          alert(`Migrated ${newOnes.length} custom food(s) from this device into your account. They'll now be available on all your devices.`);
        }
      }
    } catch {
      // Ignore malformed legacy data
    } finally {
      localStorage.removeItem('macrosync_custom_foods');
    }
  }, [mounted, currentUser, db, migratingLocalFoods]);

  useEffect(() => {
    if (mounted && currentUser && db[currentUser]) {
      const syncToCloud = async () => {
        await supabase
          .from('macros_daily_users')
          .update({ profile_data: db[currentUser], updated_at: new Date() })
          .eq('username', currentUser);
      };
      syncToCloud();
    }
  }, [db, currentUser, mounted]);

  // ==========================================
  // 5. SECURE RENDER WALL ENTRIES
  // ==========================================
  if (!mounted) return <div className="p-8 text-center text-slate-800 font-bold bg-slate-50 min-h-screen flex items-center justify-center">Loading your profile...</div>;

  if (!currentUser || !userProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-6 sm:p-8 rounded-2xl border shadow-md ${isDarkMode ? 'bg-zinc-900 border-zinc-800 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-zinc-50' : 'text-zinc-900'}`}>Macros daily</h1>
              <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'} mt-0.5`}>Simple meal and habit tracker</p>
            </div>
            <button onClick={toggleTheme} className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          <div className={`grid grid-cols-2 p-1 mb-6 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-slate-100'}`}>
            <button type="button" onClick={() => setAuthMode('signin')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${authMode === 'signin' ? (isDarkMode ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : (isDarkMode ? 'text-zinc-400' : 'text-slate-700')}`}>Sign In</button>
            <button type="button" onClick={() => setAuthMode('signup')} className={`py-1.5 text-xs font-bold rounded-md transition-all ${authMode === 'signup' ? (isDarkMode ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : (isDarkMode ? 'text-zinc-400' : 'text-slate-700')}`}>Sign Up</button>
          </div>

          {authMode === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-800'} mb-1`}>Username</label>
                <input type="text" required placeholder="Your username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className={`w-full text-sm rounded-lg px-3 py-2 border focus:ring-1 focus:ring-zinc-500 focus:outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-black placeholder-slate-400'}`}/>
              </div>
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-800'} mb-1`}>4-Digit PIN</label>
                <input type="password" required maxLength={4} placeholder="PIN" value={loginPasscode} onChange={(e) => setLoginPasscode(e.target.value)} className={`w-full text-sm rounded-lg px-3 py-2 border focus:ring-1 focus:ring-zinc-500 focus:outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-black placeholder-slate-400'}`}/>
              </div>
              <button type="submit" className={`w-full ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-900 hover:bg-zinc-800'} text-white font-semibold text-sm py-2.5 rounded-lg transition-colors shadow-sm`}>Open My Dashboard</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-800'} mb-1`}>Choose Username</label>
                <input type="text" required placeholder="e.g. akshay" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className={`w-full text-sm rounded-lg px-3 py-2 border focus:ring-1 focus:ring-zinc-500 focus:outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-black placeholder-slate-400'}`}/>
              </div>
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-800'} mb-1`}>Create 4-Digit Security PIN</label>
                <input type="password" required maxLength={4} placeholder="e.g. 1234" value={regPasscode} onChange={(e) => setRegPasscode(e.target.value)} className={`w-full text-sm rounded-lg px-3 py-2 border focus:ring-1 focus:ring-zinc-500 focus:outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-black placeholder-slate-400'}`}/>
              </div>
              <div>
                <label className={`block text-xs font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-800'} mb-1`}>Daily Calorie Goal</label>
                <input type="number" required min="0" placeholder="e.g. 2500" value={regDefaultTarget} onChange={(e) => setRegDefaultTarget(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`w-full text-sm rounded-lg px-3 py-2 border focus:ring-1 focus:ring-zinc-500 focus:outline-none ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-black placeholder-slate-400'}`}/>
              </div>
              <button type="submit" className={`w-full ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-900 hover:bg-zinc-800'} text-white font-semibold text-sm py-2.5 rounded-lg transition-colors shadow-sm`}>Create My Profile</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // State-driven explicit structural baseline colors layer configurations
  const clsBg = isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900';
  const clsCard = isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-sm' : 'bg-white border-slate-200 text-slate-900 shadow-sm shadow-slate-100';
  const clsInput = isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';
  const clsSubBg = isDarkMode ? 'bg-zinc-800/40 border-zinc-800' : 'bg-slate-100/60 border-slate-200/60';

  // Explicit text color definitions resolving high contrast constraints cleanly in Light mode
  const clsTextTitle = isDarkMode ? 'text-zinc-50' : 'text-zinc-900';
  const clsTextBody = isDarkMode ? 'text-zinc-300' : 'text-slate-800';
  const clsTextMuted = isDarkMode ? 'text-zinc-400' : 'text-slate-500';
  const clsTextMutedStrong = isDarkMode ? 'text-zinc-400' : 'text-slate-700';

  return (
    <div className={`min-h-screen ${clsBg} transition-colors duration-150 pb-12 font-sans overflow-x-hidden relative`}>
      
      {/* High-Motivation Full-Screen Celebration Popup Overlay */}
      {showConfettiEffect && (
        <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-md transition-opacity duration-300">
          {/* Animated Rising Fire and Spark Elements */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="absolute bottom-12 left-[15%] text-5xl opacity-80 animate-bounce" style={{ animationDuration: '1.2s' }}>🔥</div>
            <div className="absolute bottom-24 left-[30%] text-4xl opacity-70 animate-bounce" style={{ animationDuration: '0.9s', animationDelay: '0.2s' }}>⚡</div>
            <div className="absolute bottom-8 right-[25%] text-5xl opacity-80 animate-bounce" style={{ animationDuration: '1.4s', animationDelay: '0.1s' }}>🔥</div>
            <div className="absolute bottom-20 right-[10%] text-4xl opacity-70 animate-bounce" style={{ animationDuration: '1.1s', animationDelay: '0.3s' }}>💪</div>
            <div className="absolute top-1/4 left-[20%] text-3xl opacity-40 animate-ping" style={{ animationDuration: '1.8s' }}>✨</div>
            <div className="absolute top-1/3 right-[15%] text-4xl opacity-40 animate-ping" style={{ animationDuration: '2.2s' }}>🎉</div>
          </div>
          
          {/* Main Motivation Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl text-center max-w-sm mx-4 transform scale-100 transition-transform duration-300 flex flex-col items-center space-y-4 pointer-events-auto shadow-indigo-500/10">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 rounded-full flex items-center justify-center text-3xl shadow-lg shadow-orange-500/20 animate-pulse">
              🔥
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
                100% Habits Complete!
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
                You checked off every single habit setup for today. You are absolute fire! Keep up this incredible execution momentum.
              </p>
            </div>
            <div className="text-[11px] font-extrabold px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900/40 tracking-wide uppercase">
              Perfect Day Locked In 🎯
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Dynamic Multi-Row Fluid Responsive Header Module */}
        <header className={`${clsCard} p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4`}>
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${clsTextTitle}`}>Macros daily</h1>
              <p className={`text-[11px] ${clsTextMutedStrong} font-semibold mt-0.5`}>
                Logged user: <span className={`capitalize ${clsTextTitle} font-bold`}>{userProfile.username}</span>
              </p>
            </div>
            {/* Theme selector moved next to branding text strictly on mobile devices */}
            <button 
              type="button" 
              onClick={toggleTheme} 
              className={`sm:hidden w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-amber-400' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
          
          <div className={`flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t ${isDarkMode ? 'border-zinc-800' : 'border-slate-100'} sm:border-t-0`}>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className={`${clsInput} border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none w-full sm:w-36`}
            />

            <button 
              type="button" 
              onClick={toggleTheme} 
              className={`hidden sm:flex w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold shrink-0 ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-amber-400' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'}`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

            <div className="relative">
              <button 
                type="button" 
                onClick={() => setShowMenu(!showMenu)} 
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-bold transition-all ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              >
                ⋮
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className={`absolute right-0 mt-2 w-44 rounded-xl border p-1 shadow-lg z-20 origin-top-right transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-900'}`}>
                    <button type="button" onClick={() => { setShowSettings(true); setShowMenu(false); }} className={`w-full text-left text-xs font-bold px-3 py-2 rounded-lg ${isDarkMode ? 'hover:bg-zinc-800/60 text-zinc-200' : 'hover:bg-slate-50 text-slate-800'} flex items-center gap-2`}>⚙️ Settings</button>
                    <button type="button" onClick={() => { handleExportCSV(); setShowMenu(false); }} className={`w-full text-left text-xs font-bold px-3 py-2 rounded-lg ${isDarkMode ? 'hover:bg-zinc-800/60 text-zinc-200' : 'hover:bg-slate-50 text-slate-800'} flex items-center gap-2`}>📥 Export Data</button>
                    <div className={`border-t ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'} my-1`} />
                    <button type="button" onClick={handleLogout} className="w-full text-left text-xs font-bold px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-2">🚪 Sign Out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* View Switcher Tab Navigation */}
        <div className={`${clsCard} border p-1.5 rounded-xl flex gap-1`}>
          {([
            { key: 'daily', label: '📋 Daily Log' },
            { key: 'history', label: '🗂️ History' },
            { key: 'monthly', label: '📊 Monthly Analysis' },
          ] as { key: 'daily' | 'history' | 'monthly'; label: string }[]).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-center text-xs sm:text-sm font-bold px-2 sm:px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.key
                  ? (isDarkMode ? 'bg-zinc-800 text-white shadow-sm' : 'bg-zinc-900 text-white shadow-sm')
                  : (isDarkMode ? 'text-zinc-400 hover:bg-zinc-800/50' : 'text-slate-600 hover:bg-slate-100')
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'daily' && (
        <>
        {/* Weekly Targets Section */}
        <section className={`${clsCard} border p-4 sm:p-5 rounded-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4`}>
          <div className="text-xs sm:text-sm w-full lg:w-auto">
            <span className={`font-bold ${clsTextMuted} block text-xs uppercase tracking-wider mb-1`}>Weekly Setup</span>
            <div className={`flex items-center gap-3 ${clsTextBody} font-medium`}>
              <div>Week block: <span>{currentWeekMonday}</span></div>
              <div className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'}>|</div>
              <div>Current Goal: <span className={`font-bold ${clsTextTitle}`}>{activeWeeklyTarget} kcal / day</span></div>
            </div>
          </div>
          <form onSubmit={handleSetWeeklyTarget} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <input type="number" required min="0" placeholder="Change goal for this week" value={weeklyTargetInput} onChange={(e) => setWeeklyTargetInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border text-xs rounded-lg px-3 py-2.5 w-full lg:w-52 focus:ring-1 focus:ring-zinc-400 focus:outline-none`}/>
            <button type="submit" className={`bg-zinc-900 hover:bg-zinc-800 ${isDarkMode ? 'dark:bg-zinc-800 dark:hover:bg-zinc-700' : ''} text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all active:scale-95 shrink-0`}>Update Goal</button>
          </form>
        </section>

        {/* Analytics Display Matrix Panel */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl flex flex-col justify-between space-y-4 transition-all duration-500 ${isGoalReached ? 'ring-2 ring-indigo-500/20 scale-[1.01]' : ''}`}>
            <div>
              <h2 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted}`}>Calories Balance</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-bold tracking-tight ${clsTextTitle} transition-transform duration-300 inline-block ${isGoalReached ? 'scale-105 text-indigo-600 dark:text-indigo-400' : ''}`}>{Math.round(totals.calories)}</span>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-slate-500'}`}>/ {activeWeeklyTarget} kcal</span>
              </div>
            </div>
            <div>
              {calorieDiff === 0 ? (
                <div className={`rounded-lg p-2 text-center text-xs font-medium animate-pulse ${isDarkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-800'}`}>Goal matched exactly</div>
              ) : !isOvershot ? (
                <div className={`rounded-lg p-2.5 bg-amber-50 ${isDarkMode ? 'dark:bg-amber-950/10 dark:border-amber-900/20 dark:text-amber-400' : 'border-amber-200 text-amber-900'} border text-xs font-bold transition-all duration-300`}>
                  Remaining: <span>{Math.abs(Math.round(calorieDiff))} kcal</span>
                </div>
              ) : (
                <div className={`rounded-lg p-2.5 bg-indigo-50 ${isDarkMode ? 'dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300' : 'border-indigo-200 text-indigo-900'} border text-xs font-bold animate-pulse`}>
                  Goal Achieved! Over By: <span>{Math.round(calorieDiff)} kcal</span>
                </div>
              )}
            </div>
          </div>

          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
            <h2 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-3`}>Nutrition Logged</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Protein</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{totals.protein.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Carbs</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{totals.carbs.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Fats</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{totals.fat.toFixed(1)}g</strong></div>
              <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Fiber</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{totals.fiber.toFixed(1)}g</strong></div>
            </div>
          </div>

          <div className={`${clsCard} border p-4 sm:p-5 rounded-xl flex flex-col justify-center`}>
            <label className={`block text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-1.5`}>Weight Tracking</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" min="0" placeholder="e.g. 65.0" value={currentDayData.weight} onChange={(e) => updateProfileData({ weight: e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))) })} className={`${clsInput} border w-full text-xs sm:text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-zinc-400 focus:outline-none`}/>
              <span className={`text-xs self-center font-bold ${clsTextMutedStrong} shrink-0`}>KG</span>
            </div>
          </div>
        </section>

        {/* Dynamic Entry Stations Layout columns */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1">
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl h-full`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'} pb-2`}>Log a Meal</h3>
              <form onSubmit={handleAddFood} className="space-y-3">
                <div>
                  <label className={`block text-[10px] font-bold ${clsTextMutedStrong} uppercase`}>Meal Window</label>
                  <select value={selectedMealTime} onChange={(e) => setSelectedMealTime(e.target.value as MealTime)} className={`${clsInput} border w-full text-xs rounded-lg p-2 focus:outline-none`}>
                    {MEAL_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold ${clsTextMutedStrong} uppercase`}>Food Item</label>
                  <select value={selectedFoodIndex} onChange={(e) => setSelectedFoodIndex(Number(e.target.value))} className={`${clsInput} border w-full text-xs rounded-lg p-2 focus:outline-none`}>
                    {combinedFoodList.map((food, idx) => <option key={idx} value={idx}>{food.name} ({food.calories} kcal)</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold ${clsTextMutedStrong} uppercase`}>Quantity / Servings</label>
                  <input type="number" step="0.1" min="0" value={servings} onChange={(e) => setServings(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2 focus:outline-none`}/>
                </div>
                <button type="submit" className={`w-full bg-zinc-900 hover:bg-zinc-800 ${isDarkMode ? 'dark:bg-zinc-800 dark:hover:bg-zinc-700' : ''} text-white text-xs font-semibold py-2 rounded-lg transition-all active:scale-95 shadow-sm`}>Add to Logs</button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            
            {/* Refined Minimalist Habits Card Station Component */}
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl transition-all duration-500 ${is100Percent ? 'ring-2 ring-emerald-500/20 shadow-lg' : ''}`}>
              <div className={`flex items-center justify-between border-b ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'} pb-3 mb-4`}>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted}`}>Daily Habits Progress</h3>
                  <p className={`text-xs font-semibold mt-0.5 transition-colors duration-300 ${is100Percent ? 'text-emerald-600 dark:text-emerald-400' : clsTextBody}`}>
                    {is100Percent ? '🎉 All tasks finished!' : `${completedHabitsCount} of ${totalHabitsCount} tasks checked`}
                  </p>
                </div>

                {/* Minimalist Progress Meter Dial matching Screen Asset Specifications perfectly */}
                <div className={`relative w-12 h-12 shrink-0 rounded-full p-0.5 transition-transform duration-500 ${is100Percent ? 'animate-bounce ring-4 ring-emerald-500/20' : 'hover:scale-105'}`}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="transparent" stroke={circleTrackColor} strokeWidth="2.5" />
                    <circle cx="20" cy="20" r="18" fill="transparent" stroke={circleProgressColor} strokeWidth="2.5" 
                      strokeDasharray="113.09" strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-500 ease-out"
                    />
                    {totalHabitsCount > 0 && (
                      <circle 
                        cx={targetIndicatorX} 
                        cy={targetIndicatorY} 
                        r="3.5" 
                        fill={circleProgressColor} 
                        className="transition-all duration-500 ease-out shadow-sm"
                      />
                    )}
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-tight transition-all duration-300 ${is100Percent ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-110' : clsTextMuted}`}>
                    {habitPercentage}%
                  </div>
                </div>
              </div>

              {totalHabitsCount === 0 ? (
                <p className={`text-xs ${clsTextMutedStrong} italic`}>No custom tracking habits configured. Open settings to manage tracked routines.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeHabitsList.map((habit) => {
                    const isChecked = !!dayHabitsState[habit];
                    const isPopping = lastCheckedHabit === habit;
                    
                    return (
                      <button
                        key={habit}
                        type="button"
                        onClick={() => handleToggleHabit(habit)}
                        className={`flex items-center gap-3 w-full text-left text-xs p-2.5 rounded-lg border transition-all duration-300 transform active:scale-[0.97] ${
                          isPopping ? 'scale-[0.98] border-indigo-400' : ''
                        } ${
                          isChecked 
                            ? `${clsSubBg} ${isDarkMode ? 'border-zinc-700 text-zinc-200 bg-zinc-800/60' : 'border-indigo-100 bg-indigo-50/40 text-indigo-950'} font-bold shadow-inner` 
                            : `bg-transparent ${isDarkMode ? 'border-zinc-800 hover:border-zinc-700' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'} ${clsTextBody}`
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0 transition-all duration-300 ${
                          isChecked ? 'bg-indigo-500 border-indigo-500 text-white scale-110 rotate-[360deg]' : (isDarkMode ? 'border-zinc-600' : 'border-slate-300')
                        }`}>
                          {isChecked && '✓'}
                        </div>
                        <span className={`truncate transition-all duration-300 ${isChecked ? `line-through opacity-40 ${isDarkMode ? 'text-zinc-500' : 'text-slate-600'}` : ''}`}>{habit}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meal Records Timeline Log Table Module */}
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${clsTextMutedStrong} mb-4`}>Meal History logs</h3>
              {MEAL_TIMES.map(timeWindow => {
                const mealsInWindow = currentDayData.meals.filter(m => m.mealTime === timeWindow);
                return (
                  <div key={timeWindow} className={`mb-4 last:mb-0 border-b ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'} pb-3 last:pb-0`}>
                    <h4 className={`text-xs font-semibold ${isDarkMode ? 'text-indigo-400 bg-indigo-950/20' : 'text-indigo-600 bg-indigo-50'} inline-block px-2 py-0.5 rounded mb-2`}>{timeWindow}</h4>
                    {mealsInWindow.length === 0 ? <p className={`text-xs ${clsTextMutedStrong} italic pl-1`}>No foods logged for this window.</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[400px]">
                          <thead>
                            <tr className={`border-b ${isDarkMode ? 'border-zinc-800 text-zinc-400' : 'border-slate-200 text-slate-800'} font-bold text-[10px] uppercase`}>
                              <th className="py-1.5">Food Name</th>
                              <th className="py-1.5 text-center">Amount</th>
                              <th className="py-1.5 text-right">Calories</th>
                              <th className="py-1.5 text-right">P / C / F / Fib</th>
                              <th className="py-1.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mealsInWindow.map(item => (
                              <tr key={item.id} className={`border-b ${isDarkMode ? 'border-zinc-800/20 text-zinc-300' : 'border-slate-100 text-slate-800'} transition-colors duration-150`}>
                                <td className={`py-2 font-medium max-w-[150px] truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</td>
                                <td className={`py-2 text-center ${clsTextMutedStrong}`}>{item.servings}x</td>
                                <td className={`py-2 text-right font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{Math.round(item.calories * item.servings)} kcal</td>
                                <td className={`py-2 text-right ${clsTextMutedStrong} text-[11px]`}>{(item.protein * item.servings).toFixed(1)}g / {(item.carbs * item.servings).toFixed(1)}g / {(item.fat * item.servings).toFixed(1)}g / {(item.fiber * item.servings).toFixed(1)}g</td>
                                <td className="py-2 text-right"><button type="button" onClick={() => handleDeleteLoggedFood(item.id)} className="text-slate-400 hover:text-rose-500 font-medium px-2 transition-colors">✕</button></td>
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
        </>
        )}

        {activeTab === 'history' && (
          <section className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b pb-3 ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted}`}>Logged Days History</h3>
                <p className={`text-xs ${clsTextMutedStrong} mt-0.5`}>Every date you've recorded data for. Tap a row to jump to that day.</p>
              </div>
              <input
                type="text"
                placeholder="Filter by date (YYYY-MM-DD)"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className={`${clsInput} border text-xs rounded-lg px-3 py-2 w-full sm:w-56 focus:outline-none placeholder-slate-400`}
              />
            </div>

            {filteredHistoryRows.length === 0 ? (
              <p className={`text-xs ${clsTextMutedStrong} italic`}>No logged days found yet. Start logging meals to build your history.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-zinc-800 text-zinc-400' : 'border-slate-200 text-slate-800'} font-bold text-[10px] uppercase`}>
                      <th className="py-2">Date</th>
                      <th className="py-2 text-right">Calories</th>
                      <th className="py-2 text-right">Target</th>
                      <th className="py-2 text-right">P / C / F / Fib</th>
                      <th className="py-2 text-right">Weight</th>
                      <th className="py-2 text-right">Meals</th>
                      <th className="py-2 text-right">Habits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.map(row => (
                      <tr
                        key={row.date}
                        onClick={() => { setSelectedDate(row.date); setActiveTab('daily'); }}
                        className={`border-b cursor-pointer transition-colors duration-150 ${isDarkMode ? 'border-zinc-800/20 text-zinc-300 hover:bg-zinc-800/40' : 'border-slate-100 text-slate-800 hover:bg-slate-50'} ${row.date === selectedDate ? (isDarkMode ? 'bg-zinc-800/60' : 'bg-indigo-50/50') : ''}`}
                      >
                        <td className={`py-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{row.date}</td>
                        <td className={`py-2 text-right font-bold ${row.calories > row.target ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-600') : ''}`}>{Math.round(row.calories)} kcal</td>
                        <td className={`py-2 text-right ${clsTextMutedStrong}`}>{row.target} kcal</td>
                        <td className={`py-2 text-right ${clsTextMutedStrong} text-[11px]`}>{row.protein.toFixed(0)}g / {row.carbs.toFixed(0)}g / {row.fat.toFixed(0)}g / {row.fiber.toFixed(0)}g</td>
                        <td className={`py-2 text-right ${clsTextMutedStrong}`}>{row.weight || '—'} kg</td>
                        <td className={`py-2 text-right ${clsTextMutedStrong}`}>{row.mealsCount}</td>
                        <td className="py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${row.habitPct === 100 ? 'bg-emerald-100 text-emerald-700' : row.habitPct === 0 ? (isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-500') : 'bg-amber-100 text-amber-700'}`}>{row.habitPct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'monthly' && (
          <section className="space-y-4 sm:space-y-6">
            <div className={`${clsCard} border p-4 sm:p-5 rounded-xl flex items-center justify-between`}>
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'}`}>← Prev</button>
              <h3 className={`text-sm font-bold ${clsTextTitle}`}>{formatMonthLabel(selectedMonth)}</h3>
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'}`}>Next →</button>
            </div>

            {daysLoggedInMonth === 0 ? (
              <div className={`${clsCard} border p-6 rounded-xl text-center`}>
                <p className={`text-xs ${clsTextMutedStrong} italic`}>No entries logged for {formatMonthLabel(selectedMonth)} yet.</p>
              </div>
            ) : (
              <>
                {/* Monthly Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className={`${clsCard} border p-3 sm:p-4 rounded-xl`}>
                    <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>Days Logged</span>
                    <strong className={`text-xl font-bold ${clsTextTitle}`}>{daysLoggedInMonth}</strong>
                  </div>
                  <div className={`${clsCard} border p-3 sm:p-4 rounded-xl`}>
                    <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>Avg Calories</span>
                    <strong className={`text-xl font-bold ${clsTextTitle}`}>{Math.round(monthAvgCalories)}</strong>
                  </div>
                  <div className={`${clsCard} border p-3 sm:p-4 rounded-xl`}>
                    <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>On-Target Days</span>
                    <strong className={`text-xl font-bold ${clsTextTitle}`}>{adherencePct}%</strong>
                  </div>
                  <div className={`${clsCard} border p-3 sm:p-4 rounded-xl`}>
                    <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>Avg Habits</span>
                    <strong className={`text-xl font-bold ${clsTextTitle}`}>{monthAvgHabitPct}%</strong>
                  </div>
                </div>

                {/* Macro Averages + Weight Trend */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-3`}>Average Daily Macros</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Protein</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{monthAvgProtein.toFixed(1)}g</strong></div>
                      <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Carbs</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{monthAvgCarbs.toFixed(1)}g</strong></div>
                      <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Fats</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{monthAvgFat.toFixed(1)}g</strong></div>
                      <div className={`${clsSubBg} border p-2 rounded-lg`}><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Fiber</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{monthAvgFiber.toFixed(1)}g</strong></div>
                    </div>
                  </div>

                  <div className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-3`}>Weight Trend</h4>
                    {startWeight === null ? (
                      <p className={`text-xs ${clsTextMutedStrong} italic`}>No weight entries logged this month.</p>
                    ) : (
                      <div className="flex items-center gap-4 text-xs">
                        <div><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>Start</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{startWeight.toFixed(1)} kg</strong></div>
                        <div className={isDarkMode ? 'text-zinc-700' : 'text-slate-300'}>→</div>
                        <div><span className={`block text-[10px] ${clsTextMutedStrong} font-bold`}>End</span><strong className={`text-sm font-semibold ${clsTextTitle}`}>{endWeight!.toFixed(1)} kg</strong></div>
                        <div className={`ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold ${weightDelta! > 0 ? 'bg-indigo-50 text-indigo-700' : weightDelta! < 0 ? 'bg-emerald-50 text-emerald-700' : (isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600')}`}>
                          {weightDelta! > 0 ? '+' : ''}{weightDelta!.toFixed(1)} kg
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Daily Calories Bar Chart */}
                <div className={`${clsCard} border p-4 sm:p-5 rounded-xl`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${clsTextMuted} mb-4`}>Daily Calories vs Target</h4>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1.5 h-40 min-w-max px-1">
                      {monthRows.map(row => {
                        const barHeightPct = Math.max(2, Math.round((row.calories / monthChartMax) * 100));
                        const targetHeightPct = Math.max(0, Math.round((row.target / monthChartMax) * 100));
                        const over = row.calories > row.target;
                        return (
                          <div key={row.date} className="relative flex flex-col items-center justify-end h-full w-6 shrink-0 group">
                            <div
                              className={`absolute w-full border-t-2 border-dashed ${isDarkMode ? 'border-zinc-600' : 'border-slate-300'}`}
                              style={{ bottom: `${targetHeightPct}%` }}
                            />
                            <div
                              onClick={() => { setSelectedDate(row.date); setActiveTab('daily'); }}
                              title={`${row.date}: ${Math.round(row.calories)} kcal`}
                              className={`w-full rounded-t-sm cursor-pointer transition-all duration-200 ${over ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-emerald-400 group-hover:bg-emerald-500'}`}
                              style={{ height: `${barHeightPct}%` }}
                            />
                            <span className={`text-[8px] mt-1 rotate-0 ${clsTextMutedStrong}`}>{row.date.slice(8, 10)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] font-semibold">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> <span className={clsTextMutedStrong}>Within target</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> <span className={clsTextMutedStrong}>Over target</span></div>
                    <div className="flex items-center gap-1.5"><span className={`w-3 border-t-2 border-dashed inline-block ${isDarkMode ? 'border-zinc-600' : 'border-slate-300'}`} /> <span className={clsTextMutedStrong}>Daily goal line</span></div>
                  </div>
                </div>

                {/* Best / Worst Day Callouts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {highestCalorieDay && (
                    <div className={`${clsCard} border p-4 rounded-xl`}>
                      <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>Highest Intake Day</span>
                      <p className={`text-sm font-bold mt-1 ${clsTextTitle}`}>{formatShortDate(highestCalorieDay.date)} · {Math.round(highestCalorieDay.calories)} kcal</p>
                    </div>
                  )}
                  {lowestCalorieDay && (
                    <div className={`${clsCard} border p-4 rounded-xl`}>
                      <span className={`block text-[10px] font-bold uppercase ${clsTextMuted}`}>Lowest Intake Day</span>
                      <p className={`text-sm font-bold mt-1 ${clsTextTitle}`}>{formatShortDate(lowestCalorieDay.date)} · {Math.round(lowestCalorieDay.calories)} kcal</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* Account Settings Overlay Drawer Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 bg-slate-900/40 dark:bg-zinc-950/80 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-xl border p-5 shadow-xl relative ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            
            <div className={`flex justify-between items-center border-b ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'} pb-3 mb-5`}>
              <div>
                <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Settings & Customization</h2>
                <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Configure your custom foods list and daily habits check-list</p>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className={`text-xs px-3 py-1.5 rounded-lg border ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-slate-300 bg-slate-50 text-slate-800'} font-medium hover:bg-slate-100`}>
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Form Component: Custom Food Creator */}
              <div className="space-y-4">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400 border-zinc-800' : 'text-indigo-600 border-slate-200'} pb-1 border-b`}>Custom Foods <span className="normal-case font-medium opacity-70">(synced to your account)</span></h4>

                {(userProfile.customFoods && userProfile.customFoods.length > 0) && (
                  <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                    {userProfile.customFoods.map((food, idx) => (
                      <div key={`${food.name}-${idx}`} className={`${clsSubBg} border text-xs px-2.5 py-1.5 rounded-lg flex justify-between items-center ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'} font-semibold`}>
                        <span className="truncate">{food.name} <span className={`font-normal ${clsTextMutedStrong}`}>({food.calories} kcal)</span></span>
                        <button type="button" onClick={() => handleDeleteCustomFood(idx)} className="text-slate-600 hover:text-rose-500 font-semibold text-xs px-2 py-0.5 transition-colors shrink-0">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleCreateCustomFood} className="space-y-3">
                  <div>
                    <label className={`block text-[10px] font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'} uppercase`}>Food Name</label>
                    <input type="text" required placeholder="e.g. Protein Bar" value={newFoodName} onChange={(e) => setNewFoodName(e.target.value)} className={`${clsInput} border w-full text-xs rounded-lg p-2 mt-1 focus:outline-none placeholder-slate-400`}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Calories (kcal)</label>
                      <input type="number" min="0" value={newFoodCal} onChange={(e) => setNewFoodCal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2`}/>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Protein (g)</label>
                      <input type="number" step="0.1" min="0" value={newFoodProt} onChange={(e) => setNewFoodProt(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2`}/>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Carbs (g)</label>
                      <input type="number" step="0.1" min="0" value={newFoodCarb} onChange={(e) => setNewFoodCarb(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2`}/>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Fat (g)</label>
                      <input type="number" step="0.1" min="0" value={newFoodFat} onChange={(e) => setNewFoodFat(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2`}/>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'}`}>Fiber (g)</label>
                    <input type="number" step="0.1" min="0" value={newFoodFib} onChange={(e) => setNewFoodFib(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className={`${clsInput} border w-full text-xs rounded-lg p-2`}/>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition-all active:scale-95">
                    Add to Foods Options List
                  </button>
                </form>
              </div>

              {/* Form Segment Block: Manage Habits List Protocols */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400 border-zinc-800' : 'text-indigo-600 border-slate-200'} pb-1 border-b`}>Tracked Habits</h4>
                  
                  <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 mt-2">
                    {activeHabitsList.map(habit => (
                      <div key={habit} className={`${clsSubBg} border text-xs px-2.5 py-1.5 rounded-lg flex justify-between items-center ${isDarkMode ? 'text-zinc-200' : 'text-slate-800'} font-semibold`}>
                        <span className="truncate">{habit}</span>
                        <button type="button" onClick={() => handleDeleteCustomHabit(habit)} className="text-slate-600 hover:text-rose-500 font-semibold text-xs px-2 py-0.5 transition-colors">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCreateCustomHabit} className={`space-y-2 pt-3 border-t ${isDarkMode ? 'border-zinc-800' : 'border-slate-200'}`}>
                  <label className={`block text-[10px] font-bold ${isDarkMode ? 'text-zinc-400' : 'text-slate-700'} uppercase tracking-wider`}>Add a New Habit</label>
                  <div className="flex gap-2">
                    <input type="text" required placeholder="e.g. 💤 8 Hours Sleep Cycle" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} className={`${clsInput} border text-xs rounded-lg px-3 py-2 w-full focus:outline-none placeholder-slate-400`}/>
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all active:scale-95 shrink-0">
                      Add Habit
                    </button>
                  </div>
                </form>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}