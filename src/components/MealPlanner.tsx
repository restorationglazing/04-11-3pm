import React, { useState } from 'react';
import { Calendar, ArrowLeft, Plus, Trash2, Save, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Pin, ShoppingBag, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateDailyMeals, generateCustomRecipe, generateShoppingList } from '../utils/openai';
import { useSavedRecipes } from '../hooks/useSavedRecipes';
import ShoppingListModal from './ShoppingListModal';
import ServingsModal from './ServingsModal';
import { type MealPlan } from '../types';

const getDatesForWeek = (startDate: Date = new Date()) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const MealPlanner: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mealPlans, setMealPlans] = useState<Record<string, MealPlan>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showServingsModal, setShowServingsModal] = useState(true);
  const [servings, setServings] = useState(2);
  const [shoppingList, setShoppingList] = useState<{ category: string; items: string[] }[]>([]);
  const [isGeneratingList, setIsGeneratingList] = useState(false);
  const navigate = useNavigate();
  const { saveRecipe } = useSavedRecipes();

  const weekDates = getDatesForWeek(currentDate);
  const currentDateIndex = weekDates.findIndex(date => 
    date.toDateString() === currentDate.toDateString()
  );

  const handleGenerateShoppingList = async () => {
    if (Object.keys(mealPlans).length === 0) return;
    
    setIsGeneratingList(true);
    try {
      const allMeals = Object.values(mealPlans).flatMap(plan => [
        plan.meals.breakfast.name,
        plan.meals.lunch.name,
        plan.meals.dinner.name,
        ...(plan.meals.snacks?.map(snack => snack.name) || [])
      ]);
      
      const list = await generateShoppingList(allMeals, servings);
      setShoppingList(list);
      setShowShoppingList(true);
    } catch (error) {
      console.error('Failed to generate shopping list:', error);
      setError('Failed to generate shopping list');
    } finally {
      setIsGeneratingList(false);
    }
  };

  const handleGenerateMeals = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const plan = await generateDailyMeals(currentDate);
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: plan
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate meal plan');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRecipe = async (recipe: any) => {
    setIsSaving(recipe.id);
    try {
      const recipeDetails = await generateCustomRecipe(`Generate a detailed recipe for ${recipe.name} to serve ${servings} people`);
      saveRecipe({
        name: recipe.name,
        mealType: `${formatDate(currentDate)} - ${recipe.type}`,
        ingredients: recipeDetails.ingredients.join('\n'),
        instructions: recipeDetails.instructions.join('\n')
      });
    } catch (error) {
      console.error('Failed to save recipe:', error);
      setError('Failed to save recipe');
    } finally {
      setIsSaving(null);
    }
  };

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrentMealPlan = () => {
    return mealPlans[currentDate.toDateString()];
  };

  const handleAddMeal = (type: 'breakfast' | 'lunch' | 'dinner' | 'snacks') => {
    const currentPlan = getCurrentMealPlan();
    if (!currentPlan) return;

    const newMeal = {
      id: Date.now().toString(),
      name: '',
      type,
      calories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      ingredients: [],
      instructions: []
    };

    if (type === 'snacks') {
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: {
          ...currentPlan,
          meals: {
            ...currentPlan.meals,
            snacks: [...(currentPlan.meals.snacks || []), newMeal]
          }
        }
      }));
    } else {
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: {
          ...currentPlan,
          meals: {
            ...currentPlan.meals,
            [type]: newMeal
          }
        }
      }));
    }
  };

  const handleUpdateMeal = (type: string, mealId: string, name: string) => {
    const currentPlan = getCurrentMealPlan();
    if (!currentPlan) return;

    if (type === 'snacks') {
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: {
          ...currentPlan,
          meals: {
            ...currentPlan.meals,
            snacks: currentPlan.meals.snacks?.map(snack =>
              snack.id === mealId ? { ...snack, name } : snack
            ) || []
          }
        }
      }));
    } else {
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: {
          ...currentPlan,
          meals: {
            ...currentPlan.meals,
            [type]: { ...currentPlan.meals[type], name }
          }
        }
      }));
    }
  };

  const handleRemoveMeal = (type: string, mealId: string) => {
    const currentPlan = getCurrentMealPlan();
    if (!currentPlan) return;

    if (type === 'snacks') {
      setMealPlans(prev => ({
        ...prev,
        [currentDate.toDateString()]: {
          ...currentPlan,
          meals: {
            ...currentPlan.meals,
            snacks: currentPlan.meals.snacks?.filter(snack => snack.id !== mealId) || []
          }
        }
      }));
    } else {
      handleAddMeal(type as 'breakfast' | 'lunch' | 'dinner');
    }
  };

  if (showServingsModal) {
    return (
      <ServingsModal
        servings={servings}
        onServingsChange={setServings}
        onClose={() => setShowServingsModal(false)}
      />
    );
  }

  const currentPlan = getCurrentMealPlan();

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/success')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-800">Weekly Meal Planner</h1>
          </div>
        </div>
        <button
          onClick={() => setShowServingsModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Users className="w-5 h-5" />
          <span className="hidden sm:inline">{servings} {servings === 1 ? 'Person' : 'People'}</span>
          <span className="sm:hidden">{servings}</span>
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <button
          onClick={handleGenerateMeals}
          disabled={isGenerating}
          className={`w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 ${
            isGenerating ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating Plan...' : 'Generate Meal Plan'}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleGenerateShoppingList}
            disabled={isGeneratingList || Object.keys(mealPlans).length === 0}
            className={`w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 ${
              isGeneratingList || Object.keys(mealPlans).length === 0 ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden sm:inline">Shopping List</span>
            <span className="sm:hidden">List</span>
          </button>

          <button
            onClick={() => navigate('/recipe-book')}
            className="w-full px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            <span className="hidden sm:inline">Recipe Book</span>
            <span className="sm:hidden">Book</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousDay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <h3 className="text-xl font-semibold text-white">
              {formatDate(currentDate)}
            </h3>
            <button
              onClick={handleNextDay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {currentPlan ? (
            <>
              {['breakfast', 'lunch', 'dinner'].map((type) => (
                <div key={type} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-gray-700 capitalize">
                      {type}
                    </h4>
                    {!currentPlan.meals[type] && (
                      <button
                        onClick={() => handleAddMeal(type as 'breakfast' | 'lunch' | 'dinner')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <Plus className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                  </div>
                  {currentPlan.meals[type] ? (
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={currentPlan.meals[type].name}
                        onChange={(e) => handleUpdateMeal(type, currentPlan.meals[type].id, e.target.value)}
                        placeholder="Enter meal..."
                        className="flex-1 px-4 py-3 text-base border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                      />
                      <button
                        onClick={() => handleSaveRecipe(currentPlan.meals[type])}
                        disabled={isSaving === currentPlan.meals[type].id}
                        className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                        title="Save to recipe book"
                      >
                        <Save className={`w-5 h-5 text-green-600 ${
                          isSaving === currentPlan.meals[type].id ? 'animate-pulse' : ''
                        }`} />
                      </button>
                      <button
                        onClick={() => handleRemoveMeal(type, currentPlan.meals[type].id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove meal"
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-14 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                      No meal planned
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-700">Snacks</h4>
                  <button
                    onClick={() => handleAddMeal('snacks')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                {currentPlan.meals.snacks?.map((snack) => (
                  <div key={snack.id} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={snack.name}
                      onChange={(e) => handleUpdateMeal('snacks', snack.id, e.target.value)}
                      placeholder="Enter snack..."
                      className="flex-1 px-4 py-3 text-base border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    />
                    <button
                      onClick={() => handleSaveRecipe(snack)}
                      disabled={isSaving === snack.id}
                      className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                      title="Save to recipe book"
                    >
                      <Save className={`w-5 h-5 text-green-600 ${
                        isSaving === snack.id ? 'animate-pulse' : ''
                      }`} />
                    </button>
                    <button
                      onClick={() => handleRemoveMeal('snacks', snack.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove snack"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                ))}
                {(!currentPlan.meals.snacks || currentPlan.meals.snacks.length === 0) && (
                  <div className="h-14 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                    No snacks planned
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No meals planned for this day</p>
              <button
                onClick={handleGenerateMeals}
                className="mt-4 px-6 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                Generate Meals
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {weekDates.map((date, index) => (
          <button
            key={date.toDateString()}
            onClick={() => setCurrentDate(date)}
            className={`w-3 h-3 rounded-full transition-all ${
              currentDateIndex === index
                ? 'bg-purple-600 scale-125'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={formatDate(date)}
          />
        ))}
      </div>

      {showShoppingList && (
        <ShoppingListModal
          shoppingList={shoppingList}
          servings={servings}
          onClose={() => setShowShoppingList(false)}
        />
      )}
    </div>
  );
};

export default MealPlanner;