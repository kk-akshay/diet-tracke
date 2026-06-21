// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { FIXED_FOODS } from '../data/fixedFoods';
import { FoodItem, MealTime, LoggedFood, HistoricalLogs, DayLog } from '../types/diet';

const INITIAL_DAY_LOG = (): DayLog => ({
  weight: '',
  meals: [],
  habits: { walk: false, exercise: false, sugarCut: false }
});

export default function DietTracker() {
  // Application Configurations
  const profiles = [
    { id: 'akshay' as const, name: 'Gain', target: 3000 },
    { id: 'roommates' as const, name: 'Loss', target: 2800 }
  ];

  // State Management
  const [activeProfile, setActiveProfile] = useState<'akshay' | 'roommates'>('akshay');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [logs, setLogs] = useState<HistoricalLogs>({});
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Form States
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime>('Breakfast');
  const [selectedFoodIndex, setSelectedFoodIndex] = useState<number>(0);
  const [servings, setServings] = useState<number>(1);

  // Custom Food Creator State
  const [newFood, setNewFood] = useState<FoodItem>({
    name: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0
  });

  // Handle Hydration and local storage loading
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    
    const savedLogs = localStorage.getItem('diet_tracker_logs');
    const savedCustomFoods = localStorage.getItem('diet_tracker_custom_foods');
    const savedTheme = localStorage.getItem('diet_tracker_theme');
    
    if (savedLogs) setLogs(JSON.parse(savedLogs));
    if (savedCustomFoods) setCustomFoods(JSON.parse(savedCustomFoods));
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
    
    setMounted(true);
  }, []);

  // Sync to local storage on mutation
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('diet_tracker_logs', JSON.stringify(logs));
    }
  }, [logs, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('diet_tracker_custom_foods', JSON.stringify(customFoods));
    }
  }, [customFoods, mounted]);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('diet_tracker_theme', nextTheme ? 'dark' : 'light');
  };

  if (!mounted) return <div className="p-8 text-center text-slate-500">Loading Dashboard Backend...</div>;

  // Safe Extraction Layer
  const currentDayData: DayLog = logs[selectedDate]?.[activeProfile] || INITIAL_DAY_LOG();
  const currentTarget = profiles.find(p => p.id === activeProfile)?.target || 2000;
  const combinedFoodList = [...FIXED_FOODS, ...customFoods];

  // Helper Mutation Function
  const updateCurrentLog = (updatedData: Partial<DayLog>) => {
    setLogs(prev => {
      const dayData = prev[selectedDate] || { akshay: INITIAL_DAY_LOG(), roommates: INITIAL_DAY_LOG() };
      return {
        ...prev,
        [selectedDate]: {
          ...dayData,
          [activeProfile]: { ...dayData[activeProfile], ...updatedData }
        }
      };
    });
  };

  // Log Food Action
  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    const sourceFood = combinedFoodList[selectedFoodIndex];
    if (!sourceFood) return;

    const newLoggedItem: LoggedFood = {
      ...sourceFood,
      id: crypto.randomUUID(),
      servings,
      mealTime: selectedMealTime
    };

    updateCurrentLog({ meals: [...currentDayData.meals, newLoggedItem] });
    setServings(1);
  };

  // Create Custom Food Action
  const handleCreateCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFood.name.trim()) return;
    setCustomFoods(prev => [...prev, newFood]);
    setNewFood({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    alert(`${newFood.name} added to your custom food list options!`);
  };

  // Delete Logged Food Item Action
  const handleDeleteLoggedFood = (id: string) => {
    updateCurrentLog({ meals: currentDayData.meals.filter(m => m.id !== id) });
  };

  // Macro Totals Computations
  const totals = currentDayData.meals.reduce((acc, item) => {
    acc.calories += item.calories * item.servings;
    acc.protein += item.protein * item.servings;
    acc.carbs += item.carbs * item.servings;
    acc.fat += item.fat * item.servings;
    acc.fiber += item.fiber * item.servings;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const calorieDiff = totals.calories - currentTarget;
  const isOvershot = calorieDiff > 0;

  // Export Engine to Excel Compatible CSV Format
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Profile,Logged Weight,Meal Time,Food Name,Servings,Calories,Protein(g),Carbs(g),Fat(g),Fiber(g),Walk Metric,Exercise Metric,Sugar Cut\n";

    Object.keys(logs).sort().forEach(date => {
      ['akshay', 'roommates'].forEach(profKey => {
        const logItem = logs[date][profKey as 'akshay' | 'roommates'];
        const pName = profKey === 'akshay' ? "Akshay" : "Roommates";
        const w = logItem.weight || 'N/A';
        const hWalk = logItem.habits.walk ? 'Yes' : 'No';
        const hEx = logItem.habits.exercise ? 'Yes' : 'No';
        const hSug = logItem.habits.sugarCut ? 'Yes' : 'No';

        if (logItem.meals.length === 0) {
          csvContent += `${date},${pName},${w},None,No Meals Logged,0,0,0,0,0,0,${hWalk},${hEx},${hSug}\n`;
        } else {
          logItem.meals.forEach(m => {
            csvContent += `${date},${pName},${w},${m.mealTime},"${m.name}",${m.servings},${m.calories * m.servings},${m.protein * m.servings},${m.carbs * m.servings},${m.fat * m.servings},${m.fiber * m.servings},${hWalk},${hEx},${hSug}\n`;
          });
        }
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Diet_Logs_Export_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mealTimes: MealTime[] = ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner'];

  // Theme-driven clean style constants to prevent code complexity
  const themeBg = isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const themeCard = isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const themeInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900';
  const themeSubBg = isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100';
  const themeTextMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`min-h-screen ${themeBg} transition-colors duration-200 pb-12`}>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Top Controller Bar */}
        <header className={`${themeCard} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 justify-between items-center`}>
          <h1 className="text-xl font-bold tracking-tight">MacroSync Engine</h1>
          
          <div className="flex flex-wrap gap-3 items-center">
            {/* Dark Mode Switcher Button */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>

            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className={`${themeInput} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            
            <div className={`inline-flex ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} p-1 rounded-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActiveProfile(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                    activeProfile === p.id 
                      ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm') 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <button 
              onClick={handleExportCSV} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              Export Master Log (.CSV)
            </button>
          </div>
        </header>

        {/* Analytics Rows */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Calorie Goal Gauge */}
          <div className={`${themeCard} border p-5 rounded-xl shadow-sm flex flex-col justify-between`}>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Calorie Runway</h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{Math.round(totals.calories)}</span>
                <span className="text-sm font-medium text-slate-400">/ {currentTarget} kcal</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700/30">
              {calorieDiff === 0 ? (
                <span className="text-sm font-medium text-slate-400">Goal exact match reached.</span>
              ) : !isOvershot ? (
                <div className="text-sm font-medium text-amber-500">
                  Remaining: <strong className="font-bold">{Math.abs(Math.round(calorieDiff))} kcal</strong> to hit goal
                </div>
              ) : (
                <div className="text-sm font-medium text-rose-500">
                  Overshot Target By: <strong className="font-bold">{Math.round(calorieDiff)} kcal</strong>
                </div>
              )}
            </div>
          </div>

          {/* Macros Summary Panel */}
          <div className={`${themeCard} border p-5 rounded-xl shadow-sm`}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Macronutrients</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${themeSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Protein</span>
                <strong className="text-base">{totals.protein.toFixed(1)}g</strong>
              </div>
              <div className={`${themeSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Carbohydrates</span>
                <strong className="text-base">{totals.carbs.toFixed(1)}g</strong>
              </div>
              <div className={`${themeSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Fats</span>
                <strong className="text-base">{totals.fat.toFixed(1)}g</strong>
              </div>
              <div className={`${themeSubBg} border p-2.5 rounded-lg`}>
                <span className="block text-xs text-slate-400 font-medium">Dietary Fiber</span>
                <strong className="text-base">{totals.fiber.toFixed(1)}g</strong>
              </div>
            </div>
          </div>

          {/* Daily Weight & Checklist Metrics */}
          <div className={`${themeCard} border p-5 rounded-xl shadow-sm space-y-4`}>
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-1">Weight Tracking</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="eg. 54.2"
                  value={currentDayData.weight}
                  onChange={(e) => updateCurrentLog({ weight: e.target.value })}
                  className={`${themeInput} border w-full text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <span className="text-sm self-center font-bold text-slate-400">KG</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/30">
              <span className="block text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Habits Checkbox</span>
              <div className="flex flex-col gap-2">
                {Object.keys(currentDayData.habits).map((key) => {
                  const habitKey = key as keyof typeof currentDayData.habits;
                  const labels: Record<string, string> = { walk: 'Daily Walk Completed', exercise: 'Exercise Logged', sugarCut: 'Strict Sugar Cut Followed' };
                  return (
                    <label key={habitKey} className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={currentDayData.habits[habitKey]}
                        onChange={(e) => updateCurrentLog({
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

        {/* Core Intake Workstations */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Input Interface Columns */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form: Log Existing Food */}
            <div className={`${themeCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4 border-b border-slate-700/30 pb-2">Log Meal Intake</h3>
              <form onSubmit={handleAddFood} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select Time Window</label>
                  <select 
                    value={selectedMealTime} 
                    onChange={(e) => setSelectedMealTime(e.target.value as MealTime)}
                    className={`${themeInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  >
                    {mealTimes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select Food Source</label>
                  <select 
                    value={selectedFoodIndex} 
                    onChange={(e) => setSelectedFoodIndex(Number(e.target.value))}
                    className={`${themeInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  >
                    {combinedFoodList.map((food, idx) => (
                      <option key={idx} value={idx}>
                        {food.name} ({food.calories} kcal)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Servings / Quantity Multiplier</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0.1"
                    value={servings} 
                    onChange={(e) => setServings(Number(e.target.value))}
                    className={`${themeInput} border w-full text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg transition-colors shadow-sm">
                  Add To Log
                </button>
              </form>
            </div>

            {/* Form: Define Custom Unique Food */}
            <div className={`${themeCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4 border-b border-slate-700/30 pb-2">Create Custom Food Type</h3>
              <form onSubmit={handleCreateCustomFood} className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium ${themeTextMuted}`}>Food Description Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., Homemade Protein Shake"
                    value={newFood.name} 
                    onChange={(e) => setNewFood({...newFood, name: e.target.value})}
                    className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5 focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-xs font-medium ${themeTextMuted}`}>Calories (kcal)</label>
                    <input 
                      type="number" 
                      required 
                      min="0"
                      value={newFood.calories || ''} 
                      onChange={(e) => setNewFood({...newFood, calories: Number(e.target.value)})}
                      className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${themeTextMuted}`}>Protein (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFood.protein || ''} 
                      onChange={(e) => setNewFood({...newFood, protein: Number(e.target.value)})}
                      className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${themeTextMuted}`}>Carbs (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFood.carbs || ''} 
                      onChange={(e) => setNewFood({...newFood, carbs: Number(e.target.value)})}
                      className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${themeTextMuted}`}>Fat (g)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0"
                      value={newFood.fat || ''} 
                      onChange={(e) => setNewFood({...newFood, fat: Number(e.target.value)})}
                      className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-medium ${themeTextMuted}`}>Fiber (g)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    value={newFood.fiber || ''} 
                    onChange={(e) => setNewFood({...newFood, fiber: Number(e.target.value)})}
                    className={`${themeInput} border w-full text-sm rounded-lg p-1.5 mt-0.5`}
                  />
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-slate-700 mt-2">
                  Save Global Custom Food
                </button>
              </form>
            </div>

          </div>

          {/* Breakdown Output Lists (4 Meals Layout) */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`${themeCard} border p-5 rounded-xl shadow-sm`}>
              <h3 className="text-base font-bold mb-4">Daily Meal Records Timeline</h3>
              
              {mealTimes.map(timeWindow => {
                const mealsInWindow = currentDayData.meals.filter(m => m.mealTime === timeWindow);
                return (
                  <div key={timeWindow} className="mb-6 last:mb-0 border-b border-slate-700/20 last:border-0 pb-4 last:pb-0">
                    <h4 className="text-sm font-bold text-blue-500 bg-blue-500/10 inline-block px-2.5 py-0.5 rounded-md mb-2">
                      {timeWindow}
                    </h4>
                    
                    {mealsInWindow.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-1">No intake data recorded for this meal track.</p>
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