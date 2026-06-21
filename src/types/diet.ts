// src/types/diet.ts

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
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

// Data isolation structure per individual account
export interface UserProfileData {
  username: string;
  defaultTarget: number;
  weeklyTargets: { [mondayDateStr: string]: number }; // Dynamic targets per week block
  logs: { [dateStr: string]: DayLog };
}

export interface MultiUserStorage {
  [username: string]: UserProfileData;
}