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
  [habitName: string]: boolean;
}

export interface DayLog {
  weight: string;
  meals: LoggedFood[];
  habits: HabitTracker;
}

export interface UserProfileData {
  username: string;
  defaultTarget: number;
  weeklyTargets: { [mondayDateStr: string]: number };
  habitsList: string[];
  customFoods: FoodItem[];
  logs: { [dateStr: string]: DayLog };
}

export interface MultiUserStorage {
  [username: string]: UserProfileData;
}
