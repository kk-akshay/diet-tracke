// src/types/diet.ts

export interface FoodItem {
  name: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  fiber: number;   // in grams
}

export type MealTime = 'Breakfast' | 'Lunch' | 'Evening Snack' | 'Dinner';

export interface LoggedFood extends FoodItem {
  id: string;
  servings: number;
  mealTime: MealTime;
}

export interface HabitTracker {
  walk: boolean;
  exercise: boolean;
  sugarCut: boolean;
}

export interface DayLog {
  weight: string;
  meals: LoggedFood[];
  habits: HabitTracker;
}

export interface HistoricalLogs {
  [date: string]: {
    akshay: DayLog;
    roommates: DayLog;
  };
}