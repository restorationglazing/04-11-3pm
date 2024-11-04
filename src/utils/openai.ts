import OpenAI from 'openai';
import { type Ingredient } from '../types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface Recipe {
  name: string;
  cookTime: number;
  servings: number;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: string[];
  instructions: string[];
}

export async function generateRecipe(ingredients: Ingredient[]): Promise<Recipe> {
  const ingredientList = ingredients.map(ing => ing.name).join(', ');
  const timestamp = Date.now();
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [{
        role: "system",
        content: `You are a helpful chef that suggests recipes based on available ingredients. Return response in JSON format. Include calorie and macro information. Current timestamp: ${timestamp}`
      }, {
        role: "user",
        content: `Generate a JSON recipe using some or all of these ingredients: ${ingredientList}. Include additional common ingredients if needed. Response must be valid JSON with the following structure: { "name": string, "cookTime": number, "servings": number, "calories": number, "macros": { "protein": number, "carbs": number, "fat": number }, "ingredients": string[], "instructions": string[] }`
      }],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating recipe:', error);
    throw error;
  }
}

export async function generateCustomRecipe(prompt: string, targetCalories?: number): Promise<Recipe> {
  const timestamp = Date.now();
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [{
        role: "system",
        content: `You are a professional chef providing detailed cooking instructions. Return response in JSON format. Include calorie and macro information. Current timestamp: ${timestamp}`
      }, {
        role: "user",
        content: `Generate a JSON recipe for: ${prompt}${targetCalories ? ` with approximately ${targetCalories} calories per serving` : ''}. Response must be valid JSON with the following structure: { "name": string, "cookTime": number, "servings": number, "calories": number, "macros": { "protein": number, "carbs": number, "fat": number }, "ingredients": string[], "instructions": string[] }`
      }],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating custom recipe:', error);
    throw error;
  }
}

export interface MealPlan {
  date: string;
  totalCalories: number;
  meals: {
    breakfast: Recipe;
    lunch: Recipe;
    dinner: Recipe;
    snacks?: Recipe[];
  };
}

export async function generateDailyMeals(date: Date, targetDailyCalories?: number): Promise<MealPlan> {
  const timestamp = Date.now();
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [{
        role: "system",
        content: `You are a nutritionist creating daily meal plans. Return response in JSON format. Include calorie and macro information for each meal. Current timestamp: ${timestamp}`
      }, {
        role: "user",
        content: `Generate a JSON meal plan for ${date.toLocaleDateString()}${targetDailyCalories ? ` with approximately ${targetDailyCalories} total calories` : ''}. Response must be valid JSON with the following structure: { "date": string, "totalCalories": number, "meals": { "breakfast": Recipe, "lunch": Recipe, "dinner": Recipe, "snacks": Recipe[] } } where Recipe is { "name": string, "cookTime": number, "servings": number, "calories": number, "macros": { "protein": number, "carbs": number, "fat": number }, "ingredients": string[], "instructions": string[] }`
      }],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw error;
  }
}

export async function generateShoppingList(meals: string[], servings: number): Promise<{ category: string; items: string[] }[]> {
  const timestamp = Date.now();
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [{
        role: "system",
        content: `You are a helpful chef creating organized shopping lists. Return response in JSON format. Current timestamp: ${timestamp}`
      }, {
        role: "user",
        content: `Generate a JSON shopping list for these meals (${servings} servings each): ${meals.join(', ')}. Response must be valid JSON with the following structure: { "categories": [{ "category": string, "items": string[] }] } where categories include: Produce, Meat & Seafood, Dairy & Eggs, Pantry, Grains & Bread, Frozen, Condiments & Spices`
      }],
      model: "gpt-3.5-turbo-1106",
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.categories;
  } catch (error) {
    console.error('Error generating shopping list:', error);
    throw error;
  }
}