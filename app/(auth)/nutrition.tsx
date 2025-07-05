import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import {
  AddMealIcon,
  CaloriesIcon,
  CameraIcon,
  CarbsIcon,
  CloseIcon,
  CustomFoodIcon,
  EditIcon,
  FatIcon,
  PlusIcon,
  ProteinIcon,
  SearchIcon,
  TargetIcon
} from '../../components/icons/IconComponents'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'
import { MainLayout } from '../../layouts/MainLayout'
import { AIMealSuggestionService } from '../../services/aiMealSuggestionService'
import { MealImageAnalysisService } from '../../services/mealImageAnalysisService'
import { NutritionService } from '../../services/nutritionService'
import { PlanGenerationService } from '../../services/planGenerationService'
import { DailyNutritionSummary, FoodItem, FoodSearchResult, MealEntry, NutritionInfo } from '../../types/nutrition'

const { width } = Dimensions.get('window')

export default function Nutrition() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dailySummary, setDailySummary] = useState<DailyNutritionSummary | null>(null)
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [showPlanInfo, setShowPlanInfo] = useState(false)
  
  // FIX: Ensure selectedDate is in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  
  // Modal states
  const [showAddMeal, setShowAddMeal] = useState(false)
  const [showFoodSearch, setShowFoodSearch] = useState(false)
  const [showCustomFood, setShowCustomFood] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState<{
    breakfast: boolean
    lunch: boolean
    dinner: boolean
    snack: boolean
  }>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false
  })
  
  // NEW: Search mode state
  const [searchMode, setSearchMode] = useState<'search' | 'custom' | 'create'>('search')
  const [userCustomFoods, setUserCustomFoods] = useState<FoodItem[]>([])
  const [customFoodsLoading, setCustomFoodsLoading] = useState(false)
  
  // Custom food form state
  const [customFoodForm, setCustomFoodForm] = useState({
    name: '',
    description: '',
    brand: '',
    servingSize: '100',
    servingUnit: 'g',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    sodium: ''
  })

  // NEW: AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<{
    breakfast: FoodSearchResult[]
    lunch: FoodSearchResult[]
    dinner: FoodSearchResult[]
    snack: FoodSearchResult[]
  }>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  })
  const [suggestionsLoading, setSuggestionsLoading] = useState<{
    breakfast: boolean
    lunch: boolean
    dinner: boolean
    snack: boolean
  }>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false
  })

  // Add these 3 state variables after line 122 (after suggestionsLoading state):
  // Mobile quantity modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [quantityModalData, setQuantityModalData] = useState<{
    title: string
    message: string
    defaultValue: string
    onConfirm: (value: string) => void
  } | null>(null)
  const [quantityInput, setQuantityInput] = useState('')

  // NEW: Load user custom foods
  const loadUserCustomFoods = async () => {
    if (!user) return
    
    try {
      setCustomFoodsLoading(true)
      console.log('🥕 Loading user custom foods...')
      const customFoods = await NutritionService.getUserCustomFoods(user.uid)
      console.log('✅ Custom foods loaded:', customFoods.length)
      setUserCustomFoods(customFoods)
    } catch (error) {
      console.error('❌ Error loading custom foods:', error)
    } finally {
      setCustomFoodsLoading(false)
    }
  }

  // NEW: Edit custom food
  const editCustomFood = (food: FoodItem) => {
    setCustomFoodForm({
      name: food.name,
      description: food.description || '',
      brand: food.brand || '',
      servingSize: food.servingSize.toString(),
      servingUnit: food.servingUnit,
      calories: food.nutritionPer100g.calories.toString(),
      protein: food.nutritionPer100g.protein.toString(),
      carbs: food.nutritionPer100g.carbs.toString(),
      fat: food.nutritionPer100g.fat.toString(),
      fiber: food.nutritionPer100g.fiber?.toString() || '',
      sugar: food.nutritionPer100g.sugar?.toString() || '',
      sodium: food.nutritionPer100g.sodium?.toString() || ''
    })
    setSearchMode('create')
  }

  useEffect(() => {
    console.log('🔄 Nutrition component mounted or user/selectedDate changed')
    console.log('👤 User:', user?.uid)
    console.log('📅 Selected date:', selectedDate)
    
    if (user) {
      loadDailySummary()
    }
  }, [user, selectedDate])

  const loadDailySummary = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      console.log('🔄 Loading daily summary for:', user.uid, selectedDate)
      
      // DEBUG: Log before loading
      console.log('📊 About to load summary...')
      
      const [summary, plan] = await Promise.all([
        NutritionService.getDailySummary(user.uid, selectedDate),
        PlanGenerationService.getCurrentPlan(user.uid)
      ])
      
      console.log('✅ Daily summary loaded:', {
        totalMeals: summary.meals.length,
        mealsByType: {
          breakfast: summary.meals.filter(m => m.mealType === 'breakfast').length,
          lunch: summary.meals.filter(m => m.mealType === 'lunch').length,
          dinner: summary.meals.filter(m => m.mealType === 'dinner').length,
          snack: summary.meals.filter(m => m.mealType === 'snack').length,
        },
        meals: summary.meals.map(m => ({
          id: m.id,
          type: m.mealType,
          name: m.meal?.name || m.foodItem?.name,
          calories: m.actualNutrition.calories
        })),
        planGoals: plan ? {
          healthGoal: plan.healthGoal,
          calories: plan.nutritionGoals.calorieGoal,
          protein: plan.nutritionGoals.proteinGoal
        } : null
      })
      
      setDailySummary(summary)
      setCurrentPlan(plan)
    } catch (error) {
      console.error('❌ Error loading daily summary:', error)
      Alert.alert('Error', 'Failed to load nutrition data')
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (route: string) => {
    console.log('Navigating to:', route)
    
    switch (route) {
      case 'dashboard':
        router.push('/(auth)/dashboard')
        break
      case 'workouts':
        router.push('/(auth)/workouts')
        break
      case 'sleep':
        router.push('/(auth)/sleep')
        break
      case 'hydration':
        router.push('/(auth)/hydration')
        break
      case 'dietitians':
        router.push('/(auth)/dietitians')
        break
      case 'settings':
        router.push('/(auth)/settings')
        break
      default:
        console.log('Unknown route:', route)
        Alert.alert('Navigation Error', `Route "${route}" not found`)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🔐 IMMEDIATE LOGOUT from nutrition page')
      await logout()
      console.log('✅ LOGOUT SUCCESSFUL')
    } catch (error) {
      console.error('❌ LOGOUT FAILED:', error)
      Alert.alert('Error', 'Failed to sign out. Please try again.')
    }
  }

  const searchFoods = async (searchTerm?: string) => {
    const queryToSearch = searchTerm || searchQuery
    if (!queryToSearch.trim()) return
    
    try {
      setSearchLoading(true)
      setShowSuggestions({
        breakfast: false,
        lunch: false,
        dinner: false,
        snack: false
      })
      
      console.log('🔍 Searching for foods:', queryToSearch)
      
      // Search both API foods and custom foods
      const [apiResults, customFoods] = await Promise.all([
        NutritionService.searchFoods(queryToSearch),
        user ? NutritionService.getUserCustomFoods(user.uid) : Promise.resolve([])
      ])
      
      console.log('📊 Search results:', {
        apiResults: apiResults.foods.length,
        customFoods: customFoods.length
      })
      
      // Filter custom foods by search query
      const filteredCustomFoods = customFoods.filter(food =>
        food.name.toLowerCase().includes(queryToSearch.toLowerCase()) ||
        food.description?.toLowerCase().includes(queryToSearch.toLowerCase()) ||
        food.brand?.toLowerCase().includes(queryToSearch.toLowerCase())
      )
      
      // Convert custom foods to search result format
      const customFoodResults: FoodSearchResult[] = filteredCustomFoods.map(food => ({
        fdcId: food.id,
        description: food.name,
        brandOwner: food.brand || 'Custom',
        ingredients: food.description || '',
        servingSize: food.servingSize,
        servingSizeUnit: food.servingUnit,
        isMeal: false,
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: food.nutritionPer100g.calories },
          { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: food.nutritionPer100g.protein },
          { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: food.nutritionPer100g.carbs },
          { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: food.nutritionPer100g.fat }
        ]
      }))
      
      // Combine results with custom foods first
      const allResults = [...customFoodResults, ...apiResults.foods]
      
      // Filter out any null or invalid results
      const validResults = allResults.filter(food => 
        food && 
        food.fdcId && 
        food.description &&
        typeof food.description === 'string'
      )
      
      console.log('✅ Combined search results:', {
        customFoodResults: customFoodResults.length,
        apiResults: apiResults.foods.length,
        totalValid: validResults.length
      })
      
      setSearchResults(validResults)
      
      // Add to search history
      if (queryToSearch.trim() && !searchHistory.includes(queryToSearch.trim())) {
        setSearchHistory(prev => [queryToSearch.trim(), ...prev.slice(0, 4)])
      }
      
      if (validResults.length === 0 && queryToSearch.trim()) {
        console.log('❌ No valid results found for query:', queryToSearch)
      }
    } catch (error) {
      console.error('❌ Search error:', error)
      setSearchResults([])
      Alert.alert('Error', 'Failed to search foods. Please try again.')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchInputChange = (text: string) => {
    setSearchQuery(text)
    
    if (text.length > 0) {
      // Show suggestions based on meal type and search history
      const currentHour = new Date().getHours()
      let mealSuggestions: string[] = []
      
      if (currentHour >= 6 && currentHour < 11) {
        mealSuggestions = ['oatmeal', 'eggs', 'yogurt', 'cereal', 'toast', 'fruit']
      } else if (currentHour >= 11 && currentHour < 16) {
        mealSuggestions = ['salad', 'sandwich', 'soup', 'chicken', 'rice', 'pasta']
      } else if (currentHour >= 16 && currentHour < 22) {
        mealSuggestions = ['salmon', 'beef', 'vegetables', 'potato', 'quinoa', 'stir fry']
      } else {
        mealSuggestions = ['nuts', 'fruit', 'yogurt', 'cheese', 'crackers']
      }
      
      const filteredSuggestions = [
        ...searchHistory.filter(item => item.toLowerCase().includes(text.toLowerCase())),
        ...mealSuggestions.filter(item => 
          item.toLowerCase().includes(text.toLowerCase()) && 
          !searchHistory.includes(item)
        )
      ].slice(0, 5)
      
      setSearchSuggestions(filteredSuggestions)
      setShowSuggestions({
        breakfast: filteredSuggestions.length > 0,
        lunch: filteredSuggestions.length > 0,
        dinner: filteredSuggestions.length > 0,
        snack: filteredSuggestions.length > 0
      })
    } else {
      setShowSuggestions({
        breakfast: false,
        lunch: false,
        dinner: false,
        snack: false
      })
    }
  }

  const addMealToDaily = async (searchResult: FoodSearchResult, servings: number = 1) => {
    if (!user) {
      console.error('❌ No user found when trying to add meal')
      return
    }
    
    console.log('🍽️ Adding meal to daily log:', {
      userId: user.uid,
      meal: searchResult.description,
      servings,
      isMeal: searchResult.isMeal,
      mealType: selectedMealType,
      fdcId: searchResult.fdcId
    })
    
    try {
      // Check if this is a complete meal or individual food item
      if (searchResult.isMeal) {
        // Handle complete meal
        console.log('🥗 Processing complete meal...')
        const meal = NutritionService.convertSearchResultToMeal(searchResult)
        console.log('🍽️ Converted meal:', meal)
        
        // FIXED: Clean nutrition data to remove undefined values
        const cleanNutrition = {
          calories: meal.nutrition.calories * servings,
          protein: meal.nutrition.protein * servings,
          carbs: meal.nutrition.carbs * servings,
          fat: meal.nutrition.fat * servings,
          ...(meal.nutrition.fiber !== undefined && { fiber: meal.nutrition.fiber * servings }),
          ...(meal.nutrition.sodium !== undefined && { sodium: meal.nutrition.sodium * servings })
        }
        
        const mealEntry: Omit<MealEntry, 'id' | 'createdAt'> = {
          userId: user.uid,
          meal: meal,
          quantity: servings,
          servings: servings,
          actualNutrition: cleanNutrition,
          mealType: selectedMealType,
          consumedAt: new Date()
        }
        
        console.log('💾 Saving meal entry:', mealEntry)
        const entryId = await NutritionService.addMealEntry(mealEntry)
        console.log('✅ Meal entry saved with ID:', entryId)
        
        console.log('🔄 Reloading daily summary...')
        await loadDailySummary()
        
        setShowFoodSearch(false)
        setSearchQuery('')
        setSearchResults([])
        
        Alert.alert('Success', `${meal.name} added to ${selectedMealType}!`)
        console.log('✅ Meal addition completed successfully')
      } else {
        // Handle individual food item
        console.log('🥕 Processing individual food item...')
        
        let foodDetails: FoodItem
        
        // ✅ FIX: Check if this is an AI suggestion fallback food
        if (searchResult.fdcId.startsWith('fallback_')) {
          console.log('🤖 Detected AI suggestion fallback, creating food item directly from suggestion data')
          
          // Extract nutrition from foodNutrients
          const calories = searchResult.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 200
          const protein = searchResult.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 10
          const carbs = searchResult.foodNutrients.find(n => n.nutrientName === 'Carbohydrate')?.value || 20
          const fat = searchResult.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 8
          
          // ✅ FIX: Extract optional nutrition values safely with null fallback
          const fiber = searchResult.foodNutrients.find(n => n.nutrientName === 'Fiber')?.value ?? null
          const sugar = searchResult.foodNutrients.find(n => n.nutrientName === 'Sugar')?.value ?? null
          const sodium = searchResult.foodNutrients.find(n => n.nutrientName === 'Sodium')?.value ?? null
          
          // Create food item directly from suggestion data
          foodDetails = {
            id: searchResult.fdcId,
            name: searchResult.description,
            description: searchResult.description,
            brand: searchResult.brandOwner || 'AI Suggestion',
            servingSize: searchResult.servingSize,
            servingUnit: searchResult.servingSizeUnit,
            nutritionPer100g: {
              calories,
              protein,
              carbs,
              fat,
              fiber,
              sugar,
              sodium
            },
            isCustom: false
          }
          
          console.log('✅ Created food item from AI suggestion:', foodDetails)
        } else {
          // Use normal API fetch for real food items
          foodDetails = await NutritionService.getFoodDetails(searchResult.fdcId)
        
        if (!foodDetails) {
          throw new Error('Unable to get food details')
          }
        }
        
        const actualNutrition = NutritionService.calculateNutritionForQuantity(foodDetails, servings)
        
        // FIXED: Clean nutrition data to remove undefined values
        const cleanNutrition = {
          calories: actualNutrition.calories,
          protein: actualNutrition.protein,
          carbs: actualNutrition.carbs,
          fat: actualNutrition.fat,
          ...(actualNutrition.fiber !== undefined && { fiber: actualNutrition.fiber }),
          ...(actualNutrition.sodium !== undefined && { sodium: actualNutrition.sodium })
        }
        
        const mealEntry: Omit<MealEntry, 'id' | 'createdAt'> = {
          userId: user.uid,
          foodItem: foodDetails,
          quantity: servings,
          servings: servings / foodDetails.servingSize,
          actualNutrition: cleanNutrition,
          mealType: selectedMealType,
          consumedAt: new Date()
        }
        
        console.log('💾 Saving food entry:', mealEntry)
        const entryId = await NutritionService.addMealEntry(mealEntry)
        console.log('✅ Food entry saved with ID:', entryId)
        
        await loadDailySummary()
        setShowFoodSearch(false)
        setSearchQuery('')
        setSearchResults([])
        
        Alert.alert('Success', `${foodDetails.name} added to ${selectedMealType}!`)
      }
    } catch (error) {
      console.error('❌ Error adding meal:', error)
      Alert.alert('Error', `Failed to add meal: ${error.message}`)
    }
  }

  const handleMealSelection = (searchResult: FoodSearchResult) => {
    if (!searchResult || !searchResult.fdcId || !searchResult.description) {
      Alert.alert('Error', 'Invalid meal selected')
      return
    }

    if (searchResult.isMeal) {
      // For complete meals, ask for servings (1, 2, etc.)
      if (Platform.OS === 'web') {
        const servings = prompt('How many servings?', '1')
        if (servings && parseFloat(servings) > 0) {
          addMealToDaily(searchResult, parseFloat(servings))
        } else if (servings !== null) {
          Alert.alert('Error', 'Please enter a valid number of servings')
        }
      } else {
        showQuantityPrompt(
          'Servings',
          `How many servings of ${searchResult.description}?`,
          '1',
          (servings) => {
            const qty = parseFloat(servings || '1')
            if (qty > 0) {
              addMealToDaily(searchResult, qty)
            } else {
              Alert.alert('Error', 'Please enter a valid number of servings')
            }
          }
        )
      }
    } else {
      // For individual food items, ask for grams (existing functionality)
      if (Platform.OS === 'web') {
        const quantity = prompt('Enter quantity in grams:', '100')
        if (quantity && parseFloat(quantity) > 0) {
          addMealToDaily(searchResult, parseFloat(quantity))
        } else if (quantity !== null) {
          Alert.alert('Error', 'Please enter a valid quantity')
        }
      } else {
        showQuantityPrompt(
          'Quantity',
          'Enter quantity in grams:',
          '100',
          (quantity) => {
            const qty = parseFloat(quantity || '100')
            if (qty > 0) {
              addMealToDaily(searchResult, qty)
            } else {
              Alert.alert('Error', 'Please enter a valid quantity')
            }
          }
        )
      }
    }
  }

  const createCustomFood = async () => {
    if (!user) {
      console.error('❌ No user found when creating custom food')
      return
    }
    
    console.log('🥕 Creating custom food:', {
      userId: user.uid,
      name: customFoodForm.name,
      calories: customFoodForm.calories,
      protein: customFoodForm.protein,
      carbs: customFoodForm.carbs,
      fat: customFoodForm.fat
    })
    
    // Validate required fields
    if (!customFoodForm.name.trim() || !customFoodForm.calories || !customFoodForm.protein || !customFoodForm.carbs || !customFoodForm.fat) {
      Alert.alert('Error', 'Please fill in all required fields (name, calories, protein, carbs, fat)')
      return
    }

    try {
      const nutritionPer100g: NutritionInfo = {
        calories: parseFloat(customFoodForm.calories),
        protein: parseFloat(customFoodForm.protein),
        carbs: parseFloat(customFoodForm.carbs),
        fat: parseFloat(customFoodForm.fat),
        fiber: customFoodForm.fiber ? parseFloat(customFoodForm.fiber) : 0,
        sugar: customFoodForm.sugar ? parseFloat(customFoodForm.sugar) : 0,
        sodium: customFoodForm.sodium ? parseFloat(customFoodForm.sodium) : 0
      }

      const foodData: Omit<FoodItem, 'id' | 'isCustom' | 'userId' | 'createdAt' | 'updatedAt'> = {
        name: customFoodForm.name.trim(),
        description: customFoodForm.description.trim() || customFoodForm.name.trim(),
        brand: customFoodForm.brand.trim() || 'Custom',
        servingSize: parseFloat(customFoodForm.servingSize),
        servingUnit: customFoodForm.servingUnit,
        nutritionPer100g,
        image: customFoodImage // Add the image
      }

      console.log('💾 Saving custom food data:', foodData)
      const foodId = await NutritionService.createCustomFood(user.uid, foodData)
      console.log('✅ Custom food created with ID:', foodId)
      
      // ✅ FIX: Refresh custom foods list immediately
      await loadUserCustomFoods()
      
      // Reset form and image
      const currentName = customFoodForm.name
      setCustomFoodForm({
        name: '',
        description: '',
        brand: '',
        servingSize: '100',
        servingUnit: 'g',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        sugar: '',
        sodium: ''
      })
      setCustomFoodImage(null)
      
      // ✅ FIX: Switch to custom foods tab to show the created food
      setSearchMode('custom')
      
      // Success alert with option to add to meal
      Alert.alert(
        'Success',
        `${currentName} created successfully! You can now find it in "My Foods" tab.`,
        [
          { 
            text: 'Great!', 
            style: 'default',
            onPress: () => {
              // Food is already visible in custom foods tab
              console.log('✅ Custom food created and visible in My Foods tab')
            }
          }
        ]
      )
    } catch (error) {
      console.error('❌ Error creating custom food:', error)
      Alert.alert('Error', `Failed to create custom food: ${error.message}`)
    }
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#EF4444' // Red - exceeded
    if (percentage >= 80) return '#F59E0B' // Orange - near target
    return '#10B981' // Green - safe
  }

  const renderMacroCard = (title: string, current: number, goal: number, unit: string, icon: React.ComponentType<any>, color: string) => {
    const percentage = (current / goal) * 100
    const progressColor = getProgressColor(percentage)
    
    return (
      <View style={[styles.macroCard, { width: (width - 60) / 2 }]}>
        <View style={[styles.macroIcon, { backgroundColor: `${color}20` }]}>
          {React.createElement(icon, { size: 20, color })}
        </View>
        <Text style={styles.macroTitle}>{title}</Text>
        <Text style={[styles.macroValue, { color: progressColor }]}>
          {current}{unit}
        </Text>
        <Text style={styles.macroGoal}>of {goal}{unit}</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(percentage, 100)}%`, 
                backgroundColor: progressColor 
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: progressColor }]}>
          {Math.round(percentage)}%
        </Text>
      </View>
    )
  }

  const renderMealSection = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', title: string, target: number) => {
    const meals = dailySummary?.meals.filter(meal => meal.mealType === mealType) || []
    const consumed = meals.length
    const isExceeded = consumed > target
    const suggestions = aiSuggestions[mealType] || []
    const isLoadingSuggestions = suggestionsLoading[mealType]
    const areSuggestionsVisible = showSuggestions[mealType]
    
    console.log(`📊 Rendering ${title} section:`, {
      mealType,
      totalMealsInSummary: dailySummary?.meals.length || 0,
      filteredMeals: meals.length,
      aiSuggestions: suggestions.length,
      suggestionsVisible: areSuggestionsVisible,
      meals: meals.map(m => ({ 
        id: m.id, 
        name: m.meal?.name || m.foodItem?.name,
        calories: m.actualNutrition.calories,
        mealType: m.mealType
      }))
    })
    
    return (
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealTitle}>{title}</Text>
          <Text style={[
            styles.mealCount,
            { color: isExceeded ? '#EF4444' : consumed === target ? '#F59E0B' : '#6B7280' }
          ]}>
            {consumed}/{target}
          </Text>
          <TouchableOpacity
            style={styles.addMealButton}
            onPress={() => {
              console.log('➕ Opening add meal for:', mealType)
              setSelectedMealType(mealType)
              setShowAddMeal(true)
            }}
          >
            <PlusIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* NEW: AI Suggestions Toggle */}
        <TouchableOpacity
          style={styles.suggestionsToggle}
          onPress={() => toggleSuggestions(mealType)}
          disabled={isLoadingSuggestions}
        >
          <View style={styles.suggestionsToggleContent}>
            <Text style={styles.suggestionsToggleText}>
              🤖 AI Suggestions {areSuggestionsVisible ? '▼' : '▶'}
            </Text>
            {isLoadingSuggestions && (
              <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />
            )}
          </View>
        </TouchableOpacity>

        {/* NEW: AI Suggestions List */}
        {areSuggestionsVisible && (
          <View style={styles.suggestionsContainer}>
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => {
                // Extract nutrition info from foodNutrients
                const calories = suggestion.foodNutrients.find(n => n.nutrientName === 'Energy')?.value || 0
                const protein = suggestion.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0
                const carbs = suggestion.foodNutrients.find(n => n.nutrientName === 'Carbohydrate')?.value || 0
                const fat = suggestion.foodNutrients.find(n => n.nutrientName === 'Total fat')?.value || 0
                
                return (
                  <TouchableOpacity
                    key={`${suggestion.fdcId}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => addAISuggestedMeal(suggestion, mealType)}
                  >
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionName}>{suggestion.description}</Text>
                      <Text style={styles.suggestionNutrition}>
                        {Math.round(calories)} cal • {Math.round(protein)}g protein • {Math.round(carbs)}g carbs • {Math.round(fat)}g fat
                      </Text>
                      {suggestion.brandOwner && (
                        <Text style={styles.suggestionBrand}>{suggestion.brandOwner}</Text>
                      )}
                    </View>
                    <View style={styles.suggestionAddButton}>
                      <Text style={styles.suggestionAddText}>Add</Text>
                    </View>
                  </TouchableOpacity>
                )
              })
            ) : (
              <View style={styles.noSuggestions}>
                <Text style={styles.noSuggestionsText}>No suggestions available</Text>
                <TouchableOpacity
                  style={styles.reloadSuggestionsButton}
                  onPress={() => loadAISuggestions(mealType)}
                >
                  <Text style={styles.reloadSuggestionsText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        {meals.map((meal) => (
          <View key={meal.id} style={styles.mealItem}>
            <View style={styles.mealItemContent}>
              <Text style={styles.mealItemName}>
                {meal.meal?.name || meal.foodItem?.name || 'Unknown'}
              </Text>
              <Text style={styles.mealItemDetails}>
                {meal.meal ? (
                  `${meal.servings} ${meal.meal.servingSize} • ${meal.actualNutrition.calories} cal`
                ) : (
                  `${meal.quantity}g • ${meal.actualNutrition.calories} cal`
                )}
              </Text>
              {meal.meal?.ingredients && (
                <Text style={styles.mealItemIngredients}>
                  {meal.meal.ingredients.join(', ')}
                </Text>
              )}
            </View>
            <View style={styles.mealItemActions}>
              {/* Edit Button */}
              <TouchableOpacity
                style={styles.mealItemEdit}
                onPress={() => {
                  const currentQuantity = meal.meal ? meal.servings?.toString() || '1' : meal.quantity.toString()
                  const quantityLabel = meal.meal ? 'servings' : 'grams'
                  
                  if (Platform.OS === 'web') {
                    const newQuantity = prompt(`Enter new quantity (${quantityLabel}):`, currentQuantity)
                    if (newQuantity && parseFloat(newQuantity) > 0) {
                      updateMealQuantity(meal, parseFloat(newQuantity))
                    } else if (newQuantity !== null) {
                      Alert.alert('Error', `Please enter a valid ${quantityLabel} amount`)
                    }
                  } else {
                    showQuantityPrompt(
                      'Edit Quantity',
                      `Enter new quantity (${quantityLabel}):`,
                      currentQuantity,
                      (newQuantity) => {
                        const qty = parseFloat(newQuantity || '0')
                        if (qty > 0) {
                          updateMealQuantity(meal, qty)
                        } else {
                          Alert.alert('Error', `Please enter a valid ${quantityLabel} amount`)
                        }
                      }
                    )
                  }
                }}
              >
                <EditIcon size={16} color="#6B7280" />
              </TouchableOpacity>
              
              {/* Delete Button */}
              <TouchableOpacity
                style={styles.mealItemDelete}
                onPress={async () => {
                  try {
                    console.log('🗑️ IMMEDIATE DELETE - Meal ID:', meal.id)
                    
                    // IMMEDIATE UI UPDATE - Remove from state instantly
                    setDailySummary(prev => {
                      if (!prev) return prev
                      
                      const updatedMeals = prev.meals.filter(m => m.id !== meal.id)
                      
                      // Recalculate totals without this meal
                      const newTotalNutrition = updatedMeals.reduce(
                        (total, m) => ({
                          calories: total.calories + m.actualNutrition.calories,
                          protein: total.protein + m.actualNutrition.protein,
                          carbs: total.carbs + m.actualNutrition.carbs,
                          fat: total.fat + m.actualNutrition.fat,
                          fiber: (total.fiber || 0) + (m.actualNutrition.fiber || 0),
                          sugar: (total.sugar || 0) + (m.actualNutrition.sugar || 0),
                          sodium: (total.sodium || 0) + (m.actualNutrition.sodium || 0)
                        }),
                        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
                      )
                      
                      const newMealCounts = updatedMeals.reduce(
                        (counts, m) => {
                          counts[m.mealType]++
                          return counts
                        },
                        { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }
                      )
                      
                      return {
                        ...prev,
                        meals: updatedMeals,
                        totalNutrition: newTotalNutrition,
                        progress: {
                          calories: Math.round((newTotalNutrition.calories / prev.goals.calorieGoal) * 100),
                          protein: Math.round((newTotalNutrition.protein / prev.goals.proteinGoal) * 100),
                          carbs: Math.round((newTotalNutrition.carbs / prev.goals.carbsGoal) * 100),
                          fat: Math.round((newTotalNutrition.fat / prev.goals.fatGoal) * 100),
                          mealsConsumed: newMealCounts
                        }
                      }
                    })
                    
                    // DELETE FROM DATABASE
                    await NutritionService.deleteMealEntry(meal.id)
                    console.log('✅ DELETED FROM DATABASE:', meal.id)
                    
                  } catch (error) {
                    console.error('❌ DELETE FAILED:', error)
                    // If database delete fails, reload to restore UI
                    await loadDailySummary()
                    Alert.alert('Error', 'Failed to delete meal')
                  }
                }}
              >
                <CloseIcon size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        {meals.length === 0 && (
          <View style={styles.emptyMealSection}>
            <Text style={styles.emptyMealText}>No {title.toLowerCase()} added yet</Text>
            <Text style={styles.emptyMealSubtext}>Tap + to add your first {title.toLowerCase()}</Text>
          </View>
        )}
      </View>
    )
  }

  // Add new function to update meal quantity - FIXED VERSION
  const updateMealQuantity = async (meal: MealEntry, newQuantity: number) => {
    if (!user) {
      console.error('❌ No user found when updating meal quantity')
      return
    }
    
    try {
      console.log('✏️ Updating meal quantity:', {
        mealId: meal.id,
        oldQuantity: meal.meal ? meal.servings : meal.quantity,
        newQuantity,
        isMeal: !!meal.meal
      })
      
      let updatedNutrition: NutritionInfo
      
      if (meal.meal) {
        // Handle complete meal - update servings
        const baseNutrition = meal.meal.nutrition
        updatedNutrition = {
          calories: baseNutrition.calories * newQuantity,
          protein: baseNutrition.protein * newQuantity,
          carbs: baseNutrition.carbs * newQuantity,
          fat: baseNutrition.fat * newQuantity,
          // FIXED: Only include fiber and sodium if they exist
          ...(baseNutrition.fiber !== undefined && { fiber: baseNutrition.fiber * newQuantity }),
          ...(baseNutrition.sodium !== undefined && { sodium: baseNutrition.sodium * newQuantity })
        }
        
        await NutritionService.updateMealEntry(meal.id, {
          servings: newQuantity,
          quantity: newQuantity,
          actualNutrition: updatedNutrition
        })
      } else if (meal.foodItem) {
        // Handle individual food item - update grams
        const calculatedNutrition = NutritionService.calculateNutritionForQuantity(meal.foodItem, newQuantity)
        
        // FIXED: Clean nutrition data to remove undefined values
        updatedNutrition = {
          calories: calculatedNutrition.calories,
          protein: calculatedNutrition.protein,
          carbs: calculatedNutrition.carbs,
          fat: calculatedNutrition.fat,
          ...(calculatedNutrition.fiber !== undefined && { fiber: calculatedNutrition.fiber }),
          ...(calculatedNutrition.sodium !== undefined && { sodium: calculatedNutrition.sodium })
        }
        
        await NutritionService.updateMealEntry(meal.id, {
          quantity: newQuantity,
          servings: newQuantity / meal.foodItem.servingSize,
          actualNutrition: updatedNutrition
        })
      } else {
        throw new Error('Invalid meal entry - no meal or foodItem found')
      }
      
      console.log('✅ Meal quantity updated successfully')
      await loadDailySummary()
      Alert.alert('Success', 'Meal quantity updated successfully')
      
    } catch (error) {
      console.error('❌ Error updating meal quantity:', error)
      Alert.alert('Error', `Failed to update meal: ${error.message}`)
    }
  }

  // Add new useEffect to load current plan
  useEffect(() => {
    if (user?.uid) {
      loadCurrentPlan()
    }
  }, [user?.uid])

  const loadCurrentPlan = async () => {
    if (!user?.uid) return
    
    try {
      const plan = await PlanGenerationService.getCurrentPlan(user.uid)
      setCurrentPlan(plan)
    } catch (error) {
      console.error('❌ Error loading current plan:', error)
    }
  }

  // NEW: Load AI suggestions for each meal type
  const loadAISuggestions = async (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (!user || aiSuggestions[mealType].length > 0) return
    
    try {
      setSuggestionsLoading(prev => ({ ...prev, [mealType]: true }))
      console.log(`🤖 Loading AI suggestions for ${mealType}`)
      
      // Get user preferences from current plan if available
      const userPreferences = currentPlan ? {
        healthGoal: currentPlan.healthGoal,
        dietaryRestrictions: currentPlan.dietaryRestrictions || [],
        preferredCuisines: currentPlan.preferredCuisines || []
      } : undefined
      
      // Pass userId to the AI service
      const suggestions = await AIMealSuggestionService.generateMealSuggestions(
        mealType,
        user.uid, // Pass the user ID
        userPreferences
      )
      
      // Filter out any invalid suggestions and ensure we have nutrition data
      const validSuggestions = suggestions.filter(suggestion => 
        suggestion && 
        suggestion.fdcId && 
        suggestion.description &&
        suggestion.foodNutrients &&
        suggestion.foodNutrients.length > 0
      )
      
      console.log(`✅ Loaded ${validSuggestions.length} AI suggestions for ${mealType}`)
      setAiSuggestions(prev => ({ ...prev, [mealType]: validSuggestions }))
      
    } catch (error) {
      console.error(`❌ Error loading AI suggestions for ${mealType}:`, error)
    } finally {
      setSuggestionsLoading(prev => ({ ...prev, [mealType]: false }))
    }
  }

  // NEW: Toggle suggestions visibility
  const toggleSuggestions = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    const isCurrentlyShown = showSuggestions[mealType]
    
    if (!isCurrentlyShown && aiSuggestions[mealType].length === 0) {
      // Load suggestions if not loaded yet
      loadAISuggestions(mealType)
    }
    
    setShowSuggestions(prev => ({ ...prev, [mealType]: !isCurrentlyShown }))
  }

  // NEW: Add AI suggested meal - FIXED VERSION
  const addAISuggestedMeal = async (suggestion: FoodSearchResult, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (!user) return
    
    try {
      console.log('🤖 Adding AI suggested meal:', {
        suggestion: suggestion.description,
        mealType,
        userId: user.uid
      })
      
      // Set the meal type first
      setSelectedMealType(mealType)
      
      // Use the exact same logic as handleMealSelection - prompt for quantity
      if (!suggestion || !suggestion.fdcId || !suggestion.description) {
        Alert.alert('Error', 'Invalid meal selected')
        return
      }

      if (suggestion.isMeal) {
        // For complete meals, ask for servings (1, 2, etc.)
        if (Platform.OS === 'web') {
          const servings = prompt('How many servings?', '1')
          if (servings && parseFloat(servings) > 0) {
            await addMealToDaily(suggestion, parseFloat(servings))
          } else if (servings !== null) {
            Alert.alert('Error', 'Please enter a valid number of servings')
          }
        } else {
          showQuantityPrompt(
            'Servings',
            `How many servings of ${suggestion.description}?`,
            '1',
            async (servings) => {
              const qty = parseFloat(servings || '1')
              if (qty > 0) {
                await addMealToDaily(suggestion, qty)
              } else {
                Alert.alert('Error', 'Please enter a valid number of servings')
              }
            }
          )
        }
      } else {
        // For individual food items, ask for grams (existing functionality)
        if (Platform.OS === 'web') {
          const quantity = prompt('Enter quantity in grams:', '100')
          if (quantity && parseFloat(quantity) > 0) {
            await addMealToDaily(suggestion, parseFloat(quantity))
          } else if (quantity !== null) {
            Alert.alert('Error', 'Please enter a valid quantity')
          }
        } else {
          showQuantityPrompt(
            'Quantity',
            'Enter quantity in grams:',
            '100',
            async (quantity) => {
              const qty = parseFloat(quantity || '100')
              if (qty > 0) {
                await addMealToDaily(suggestion, qty)
              } else {
                Alert.alert('Error', 'Please enter a valid quantity')
              }
            }
          )
        }
      }
      
      console.log('✅ AI suggested meal selection completed')
    } catch (error) {
      console.error('❌ Error adding AI suggested meal:', error)
      Alert.alert('Error', `Failed to add ${suggestion.description}: ${error.message}`)
    }
  }

  // Image upload state
  const [customFoodImage, setCustomFoodImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a photo.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setCustomFoodImage(base64Image);
        analyzeImage(base64Image);
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setCustomFoodImage(base64Image);
        analyzeImage(base64Image);
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const analyzeImage = async (imageBase64: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to analyze food images.');
      return;
    }

    try {
      setIsAnalyzingImage(true);
      
      // Call the meal image analysis service
      const result = await MealImageAnalysisService.analyzeImage(user.uid, imageBase64);
      
      if (result.success) {
        // Update the form with the analysis results
        setCustomFoodForm(prev => ({
          ...prev,
          name: result.foodName,
          description: result.description || '',
          calories: result.nutritionPer100g.calories.toString(),
          protein: result.nutritionPer100g.protein.toString(),
          carbs: result.nutritionPer100g.carbs.toString(),
          fat: result.nutritionPer100g.fat.toString(),
          fiber: result.nutritionPer100g.fiber ? result.nutritionPer100g.fiber.toString() : '',
          sugar: result.nutritionPer100g.sugar ? result.nutritionPer100g.sugar.toString() : '',
          sodium: result.nutritionPer100g.sodium ? result.nutritionPer100g.sodium.toString() : ''
        }));
        
        Alert.alert('Success', 'Food analyzed successfully! Please verify the nutritional information and adjust if needed.');
      } else {
        Alert.alert('Analysis Failed', result.message || 'Could not analyze the food image. Please enter nutritional information manually.');
      }
    } catch (error) {
      console.error('❌ Error analyzing food image:', error);
      Alert.alert('Error', 'Failed to analyze food image. Please try again or enter information manually.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Add this function after handleLogout function (around line 250):
  const showQuantityPrompt = (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setQuantityModalData({ title, message, defaultValue, onConfirm })
    setQuantityInput(defaultValue)
    setShowQuantityModal(true)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout
          title="Nutrition"
          activeRoute="nutrition"
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={{
            name: user?.displayName || 'User',
            email: user?.email || '',
            photoURL: user?.photoURL
          }}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading nutrition data...</Text>
          </View>
        </MainLayout>
      </ProtectedRoute>
    )
  }

  // Add plan info modal component
  const PlanInfoModal = () => (
    <Modal
      visible={showPlanInfo}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPlanInfo(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.planInfoModal}>
          <View style={styles.planInfoHeader}>
            <Text style={styles.planInfoTitle}>Your Nutrition Plan</Text>
            <TouchableOpacity onPress={() => setShowPlanInfo(false)}>
              <CloseIcon size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {currentPlan && (
            <ScrollView style={styles.planInfoContent}>
              <View style={styles.planInfoSection}>
                <Text style={styles.planInfoSectionTitle}>Health Goal: {currentPlan.healthGoal}</Text>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Daily Calorie Target:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.nutritionGoals.calorieGoal} cal</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Protein Target:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.nutritionGoals.proteinGoal}g</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Carbs Target:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.nutritionGoals.carbsGoal}g</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Fat Target:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.nutritionGoals.fatGoal}g</Text>
                </View>
              </View>
              
              <View style={styles.planTip}>
                <Text style={styles.planTipTitle}>💡 Plan Tip</Text>
                <Text style={styles.planTipText}>
                  {getPlanTip(currentPlan.healthGoal)}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )

  const getPlanTip = (healthGoal: string): string => {
    const tips = {
      'Lose Weight': 'Focus on high-protein foods and vegetables to stay full while maintaining a calorie deficit.',
      'Gain Weight': 'Include healthy fats and complex carbs. Consider adding nutritious snacks between meals.',
      'Build Muscle': 'Prioritize protein intake, especially after workouts. Aim for 1.6-2.2g protein per kg body weight.',
      'Improve Fitness': 'Balance your macros with emphasis on carbs for energy and protein for recovery.',
    }
    return tips[healthGoal as keyof typeof tips] || 'Maintain a balanced diet with variety and proper portions.'
  }

  return (
    <ProtectedRoute>
      <MainLayout
        title="Nutrition"
        activeRoute="nutrition"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Add Plan Info Header */}
          {currentPlan && (
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeft}>
                <Text style={styles.planHeaderTitle}>Plan: {currentPlan.healthGoal}</Text>
                <Text style={styles.planHeaderSubtitle}>
                  {currentPlan.nutritionGoals.calorieGoal} cal • {currentPlan.nutritionGoals.proteinGoal}g protein
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.planInfoButton}
                onPress={() => setShowPlanInfo(true)}
              >
                <Text style={styles.planInfoButtonText}>View Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Date Selection */}
          <View style={styles.section}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateTitle}>Today's Nutrition</Text>
              <TouchableOpacity
                style={styles.goalsButton}
                onPress={() => setShowGoalsModal(true)}
              >
                <TargetIcon size={20} color="#10B981" />
                <Text style={styles.goalsButtonText}>Goals</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateSubtitle}>{selectedDate}</Text>
          </View>

          {/* Macro Overview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Progress</Text>
            <View style={styles.macrosGrid}>
              {renderMacroCard(
                'Calories',
                dailySummary?.totalNutrition.calories || 0,
                dailySummary?.goals.calorieGoal || 2000,
                '',
                CaloriesIcon,
                '#EF4444'
              )}
              {renderMacroCard(
                'Protein',
                dailySummary?.totalNutrition.protein || 0,
                dailySummary?.goals.proteinGoal || 150,
                'g',
                ProteinIcon,
                '#10B981'
              )}
              {renderMacroCard(
                'Carbs',
                dailySummary?.totalNutrition.carbs || 0,
                dailySummary?.goals.carbsGoal || 250,
                'g',
                CarbsIcon,
                '#3B82F6'
              )}
              {renderMacroCard(
                'Fat',
                dailySummary?.totalNutrition.fat || 0,
                dailySummary?.goals.fatGoal || 65,
                'g',
                FatIcon,
                '#F59E0B'
              )}
            </View>
          </View>

          {/* Meals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meals</Text>
            {renderMealSection('breakfast', 'Breakfast', dailySummary?.goals.targetMeals.breakfast || 1)}
            {renderMealSection('lunch', 'Lunch', dailySummary?.goals.targetMeals.lunch || 1)}
            {renderMealSection('dinner', 'Dinner', dailySummary?.goals.targetMeals.dinner || 1)}
            {renderMealSection('snack', 'Snacks', dailySummary?.goals.targetMeals.snacks || 2)}
          </View>
        </ScrollView>

        {/* Add Meal Modal */}
        <Modal visible={showAddMeal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add {selectedMealType}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowAddMeal(false)}
                >
                  <CloseIcon size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowAddMeal(false)
                  setSearchMode('search')
                  setShowFoodSearch(true)
                }}
              >
                <SearchIcon size={24} color="#10B981" />
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionText}>Search Foods</Text>
                  <Text style={styles.modalOptionSubtext}>Find foods from our database</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalOption}
                onPress={async () => {
                  setShowAddMeal(false)
                  setSearchMode('custom')
                  await loadUserCustomFoods()
                  setShowFoodSearch(true)
                }}
              >
                <CustomFoodIcon size={24} color="#F59E0B" />
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionText}>My Custom Foods</Text>
                  <Text style={styles.modalOptionSubtext}>Select from your created foods</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowAddMeal(false)
                  setSearchMode('create')
                  setShowFoodSearch(true)
                }}
              >
                <AddMealIcon size={24} color="#8B5CF6" />
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionText}>Create Custom Food</Text>
                  <Text style={styles.modalOptionSubtext}>Add a new food to your collection</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowAddMeal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Food Search Modal */}
        <Modal visible={showFoodSearch} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { height: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add to {selectedMealType}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowFoodSearch(false)
                    setSearchQuery('')
                    setSearchResults([])
                    setShowSuggestions({
                      breakfast: false,
                      lunch: false,
                      dinner: false,
                      snack: false
                    })
                  }}
                >
                  <CloseIcon size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Search Options Tabs */}
              <View style={styles.searchTabs}>
                <TouchableOpacity
                  style={[styles.searchTab, searchMode === 'search' && styles.activeTab]}
                  onPress={() => setSearchMode('search')}
                >
                  <SearchIcon size={16} color={searchMode === 'search' ? '#ffffff' : '#6B7280'} />
                  <Text style={[styles.tabText, searchMode === 'search' && styles.activeTabText]}>
                    Search Foods
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.searchTab, searchMode === 'custom' && styles.activeTab]}
                  onPress={() => {
                    setSearchMode('custom')
                    loadUserCustomFoods()
                  }}
                >
                  <CustomFoodIcon size={16} color={searchMode === 'custom' ? '#ffffff' : '#6B7280'} />
                  <Text style={[styles.tabText, searchMode === 'custom' && styles.activeTabText]}>
                    My Foods
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.searchTab, searchMode === 'create' && styles.activeTab]}
                  onPress={() => setSearchMode('create')}
                >
                  <AddMealIcon size={16} color={searchMode === 'create' ? '#ffffff' : '#6B7280'} />
                  <Text style={[styles.tabText, searchMode === 'create' && styles.activeTabText]}>
                    Create Food
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Search Mode Content */}
              {searchMode === 'search' && (
                <>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={`Search foods for ${selectedMealType}...`}
                      value={searchQuery}
                      onChangeText={handleSearchInputChange}
                      onSubmitEditing={() => searchFoods()}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.searchButton}
                      onPress={() => searchFoods()}
                      disabled={searchLoading}
                    >
                      {searchLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <SearchIcon size={20} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Search Suggestions */}
                  {showSuggestions[selectedMealType] && (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Suggestions</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {searchSuggestions.map((suggestion, index) => (
                          <TouchableOpacity
                            key={index}
                            style={styles.suggestionChip}
                            onPress={() => {
                              setSearchQuery(suggestion)
                              searchFoods(suggestion)
                            }}
                          >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  
                  <ScrollView style={styles.searchResults}>
                    {searchResults.length === 0 && !searchLoading && !searchQuery && (
                      <View style={styles.welcomeContainer}>
                        <Text style={styles.welcomeTitle}>
                          What would you like for {selectedMealType}?
                        </Text>
                        <Text style={styles.welcomeSubtext}>
                          Search for foods from our database or try your custom foods
                        </Text>
                      </View>
                    )}

                    {searchResults
                      .filter(item => item && item.description)
                      .map((item, index) => (
                        <TouchableOpacity
                          key={`${item.fdcId}-${index}`}
                          style={[
                            styles.foodResult,
                            item.isMeal && styles.mealResult,
                            item.brandOwner === 'Custom' && styles.customFoodResult
                          ]}
                          onPress={() => handleMealSelection(item)}
                        >
                          <View style={styles.foodResultContent}>
                            <View style={styles.foodResultHeader}>
                              <Text style={styles.foodName}>
                                {item.description}
                              </Text>
                              {item.isMeal && (
                                <View style={styles.mealBadge}>
                                  <Text style={styles.mealBadgeText}>Complete Meal</Text>
                                </View>
                              )}
                              {item.brandOwner === 'Custom' && (
                                <View style={styles.customBadge}>
                                  <Text style={styles.customBadgeText}>Custom</Text>
                                </View>
                              )}
                            </View>
                            
                            {item.isMeal ? (
                              <>
                                <Text style={styles.mealServing}>
                                  Serving: {item.servingDescription || `1 ${item.servingSizeUnit}`}
                                </Text>
                                <Text style={styles.foodCategory}>
                                  {item.ingredients}
                                </Text>
                              </>
                            ) : (
                              <>
                                {item.brandOwner && item.brandOwner !== 'Custom' && (
                                  <Text style={styles.foodBrand}>{item.brandOwner}</Text>
                                )}
                                {item.ingredients && (
                                  <Text style={styles.foodCategory}>{item.ingredients}</Text>
                                )}
                                <Text style={styles.servingInfo}>
                                  Serving: {item.servingSize}{item.servingSizeUnit}
                                </Text>
                              </>
                            )}
                          </View>
                          <View style={[
                            styles.addButton, 
                            item.isMeal && styles.mealAddButton,
                            item.brandOwner === 'Custom' && styles.customAddButton
                          ]}>
                            <Text style={styles.addButtonText}>
                              {item.isMeal ? 'Add Meal' : 'Add Food'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    
                    {searchResults.length === 0 && !searchLoading && searchQuery && (
                      <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>
                          No foods found for "{searchQuery}"
                        </Text>
                        <Text style={styles.noResultsSubtext}>
                          Try a different search term or create a custom food
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </>
              )}
              
              {/* Custom Foods Mode */}
              {searchMode === 'custom' && (
                <ScrollView style={styles.customFoodsList}>
                  {customFoodsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#10B981" />
                      <Text style={styles.loadingText}>Loading your custom foods...</Text>
                    </View>
                  ) : userCustomFoods.length === 0 ? (
                    <View style={styles.emptyCustomFoods}>
                      <CustomFoodIcon size={48} color="#D1D5DB" />
                      <Text style={styles.emptyCustomFoodsTitle}>No Custom Foods Yet</Text>
                      <Text style={styles.emptyCustomFoodsText}>
                        Create your first custom food to see it here
                      </Text>
                      <TouchableOpacity
                        style={styles.createFirstFoodButton}
                        onPress={() => setSearchMode('create')}
                      >
                        <Text style={styles.createFirstFoodButtonText}>Create Custom Food</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    userCustomFoods.map((food, index) => (
                      <TouchableOpacity
                        key={food.id}
                        style={styles.customFoodItem}
                        onPress={() => {
                          // Convert custom food to search result format
                          const searchResult: FoodSearchResult = {
                            fdcId: food.id,
                            description: food.name,
                            brandOwner: 'Custom',
                            ingredients: food.description || '',
                            servingSize: food.servingSize,
                            servingSizeUnit: food.servingUnit,
                            isMeal: false,
                            foodNutrients: [
                              { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: food.nutritionPer100g.calories },
                              { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: food.nutritionPer100g.protein },
                              { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: food.nutritionPer100g.carbs },
                              { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: food.nutritionPer100g.fat }
                            ]
                          }
                          handleMealSelection(searchResult)
                        }}
                      >
                        <View style={styles.customFoodInfo}>
                          <Text style={styles.customFoodName}>{food.name}</Text>
                          <Text style={styles.customFoodDescription}>{food.description || food.brand}</Text>
                          <Text style={styles.customFoodNutrition}>
                            {food.nutritionPer100g.calories} cal per {food.servingSize}{food.servingUnit}
                          </Text>
                        </View>
                        <View style={styles.customFoodActions}>
                          <TouchableOpacity
                            style={styles.editCustomFoodButton}
                            onPress={(e) => {
                              e.stopPropagation()
                              editCustomFood(food)
                            }}
                          >
                            <EditIcon size={16} color="#6B7280" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.addCustomFoodButton}
                            onPress={(e) => {
                              e.stopPropagation()
                              const searchResult: FoodSearchResult = {
                                fdcId: food.id,
                                description: food.name,
                                brandOwner: 'Custom',
                                ingredients: food.description || '',
                                servingSize: food.servingSize,
                                servingSizeUnit: food.servingUnit,
                                isMeal: false,
                                foodNutrients: [
                                  { nutrientId: 1008, nutrientName: 'Energy', nutrientNumber: '208', unitName: 'kcal', value: food.nutritionPer100g.calories },
                                  { nutrientId: 1003, nutrientName: 'Protein', nutrientNumber: '203', unitName: 'g', value: food.nutritionPer100g.protein },
                                  { nutrientId: 1005, nutrientName: 'Carbohydrate', nutrientNumber: '205', unitName: 'g', value: food.nutritionPer100g.carbs },
                                  { nutrientId: 1004, nutrientName: 'Total fat', nutrientNumber: '204', unitName: 'g', value: food.nutritionPer100g.fat }
                                ]
                              }
                              handleMealSelection(searchResult)
                            }}
                          >
                            <Text style={styles.addCustomFoodButtonText}>Add</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
              
              {/* Create Custom Food Mode */}
              {searchMode === 'create' && (
                <ScrollView style={styles.customFoodForm}>
                  {/* Inline custom food creation form */}
                  <Text style={styles.formSectionTitle}>Create Custom Food</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Food Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g., Homemade Chicken Salad"
                      value={customFoodForm.name}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, name: text }))}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Optional description"
                      value={customFoodForm.description}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, description: text }))}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Serving Size *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="100"
                        value={customFoodForm.servingSize}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, servingSize: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Unit *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="g"
                        value={customFoodForm.servingUnit}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, servingUnit: text }))}
                      />
                    </View>
                  </View>

                  <Text style={styles.formSectionTitle}>Nutrition per 100g</Text>
                  
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Calories *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="250"
                        value={customFoodForm.calories}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, calories: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Protein (g) *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="20"
                        value={customFoodForm.protein}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, protein: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Carbs (g) *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="30"
                        value={customFoodForm.carbs}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, carbs: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.inputLabel}>Fat (g) *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="10"
                        value={customFoodForm.fat}
                        onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, fat: text }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Food Image</Text>
                    <View style={styles.imageUploadContainer}>
                      {customFoodImage ? (
                        <View style={styles.imagePreviewContainer}>
                          <Image source={{ uri: customFoodImage }} style={styles.imagePreview} />
                          <TouchableOpacity 
                            style={styles.removeImageButton}
                            onPress={() => setCustomFoodImage(null)}
                          >
                            <CloseIcon size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.imageUploadButtons}>
                          <TouchableOpacity 
                            style={styles.imageButton} 
                            onPress={takePhoto}
                            disabled={isAnalyzingImage}
                          >
                            <CameraIcon size={24} color="#FFFFFF" />
                            <Text style={styles.imageButtonText}>Take Photo</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.imageButton} 
                            onPress={pickImage}
                            disabled={isAnalyzingImage}
                          >
                            <Ionicons name="image-outline" size={24} color="#FFFFFF" />
                            <Text style={styles.imageButtonText}>Upload</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {isAnalyzingImage && (
                      <View style={styles.analyzingContainer}>
                        <ActivityIndicator size="small" color="#10B981" />
                        <Text style={styles.analyzingText}>Analyzing food image with AI...</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.createFoodButton}
                    onPress={async () => {
                      await createCustomFood()
                      // After creating, switch to custom foods tab to show it
                      await loadUserCustomFoods()
                      setSearchMode('custom')
                    }}
                  >
                    <Text style={styles.createFoodButtonText}>Create & Save Food</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Custom Food Modal */}
        <Modal visible={showCustomFood} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { height: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Custom Food</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowCustomFood(false)
                    // Reset form when closing
                    setCustomFoodForm({
                      name: '',
                      description: '',
                      brand: '',
                      servingSize: '100',
                      servingUnit: 'g',
                      calories: '',
                      protein: '',
                      carbs: '',
                      fat: '',
                      fiber: '',
                      sugar: '',
                      sodium: ''
                    })
                  }}
                >
                  <CloseIcon size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.customFoodForm}>
                {/* Basic Information */}
                <Text style={styles.formSectionTitle}>Basic Information</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Food Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Homemade Chicken Salad"
                    value={customFoodForm.name}
                    onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, name: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional description"
                    value={customFoodForm.description}
                    onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, description: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Brand</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional brand name"
                    value={customFoodForm.brand}
                    onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, brand: text }))}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Serving Size</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="100"
                      value={customFoodForm.servingSize}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, servingSize: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Unit</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="g"
                      value={customFoodForm.servingUnit}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, servingUnit: text }))}
                    />
                  </View>
                </View>

                {/* Macronutrients */}
                <Text style={styles.formSectionTitle}>Macronutrients (per 100g) *</Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Calories *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.calories}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, calories: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Protein (g) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.protein}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, protein: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Carbs (g) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.carbs}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, carbs: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Fat (g) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.fat}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, fat: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Optional Nutrients */}
                <Text style={styles.formSectionTitle}>Optional Nutrients (per 100g)</Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Fiber (g)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.fiber}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, fiber: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Sugar (g)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      value={customFoodForm.sugar}
                      onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, sugar: text }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sodium (mg)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    value={customFoodForm.sodium}
                    onChangeText={(text) => setCustomFoodForm(prev => ({ ...prev, sodium: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={styles.createButton}
                  onPress={createCustomFood}
                >
                  <Text style={styles.createButtonText}>Create Custom Food</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
        
        {/* Add Plan Info Modal */}
        <PlanInfoModal />
      </MainLayout>
      {/* Mobile Quantity Modal */}
      <Modal visible={showQuantityModal} transparent animationType="slide">
        <View style={styles.quantityModalOverlay}>
          <View style={styles.quantityModalContainer}>
            <Text style={styles.quantityModalTitle}>
              {quantityModalData?.title || 'Enter Quantity'}
            </Text>
            <Text style={styles.quantityModalMessage}>
              {quantityModalData?.message || 'Enter quantity:'}
            </Text>
            <TextInput
              style={styles.quantityModalInput}
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="numeric"
              autoFocus={true}
              selectTextOnFocus={true}
            />
            <View style={styles.quantityModalButtons}>
              <TouchableOpacity
                style={styles.quantityModalCancelButton}
                onPress={() => setShowQuantityModal(false)}
              >
                <Text style={styles.quantityModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityModalConfirmButton}
                onPress={() => {
                  if (quantityInput.trim()) {
                    setShowQuantityModal(false)
                    quantityModalData?.onConfirm(quantityInput.trim())
                  }
                }}
              >
                <Text style={styles.quantityModalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ProtectedRoute>
  )
}

// Remove the problematic merge code and replace with a single comprehensive styles definition
const styles = StyleSheet.create({
  // Main container styles
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Section styles
  section: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  
  // Date header styles
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  dateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  goalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
  },
  goalsButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  
  // Macro card styles
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  macroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  macroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  macroGoal: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Meal section styles
  mealSection: {
    marginBottom: 24,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  mealCount: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 8,
    marginBottom: 12,
  },
  
  // NEW: AI Suggestions styles
  suggestionsToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionsToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionsToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  suggestionsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionContent: {
    flex: 1,
    marginRight: 12,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  suggestionNutrition: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  suggestionBrand: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  suggestionAddButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  suggestionAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  noSuggestions: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noSuggestionsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  reloadSuggestionsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  reloadSuggestionsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Meal item styles
  mealItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  mealItemContent: {
    flex: 1,
  },
  mealItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  mealItemDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  mealItemIngredients: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  mealItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  mealItemEdit: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EBF8FF',
    borderRadius: 4,
    marginRight: 8,
  },
  mealItemDelete: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
  },
  
  // Empty state styles
  emptyMealSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyMealText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyMealSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  
  // Modal option styles
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionContent: {
    marginLeft: 16,
    flex: 1,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  modalOptionSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  
  // Search styles
  searchTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Search suggestions styles (different from AI suggestions)
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  suggestionChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#374151',
  },
  
  // Food result styles
  foodResult: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealResult: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  customFoodResult: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  foodResultContent: {
    flex: 1,
    marginRight: 12,
  },
  foodResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  mealBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  mealBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#059669',
  },
  customBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#D97706',
  },
  foodBrand: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  foodCategory: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  servingInfo: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  mealServing: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  mealAddButton: {
    backgroundColor: '#059669',
  },
  customAddButton: {
    backgroundColor: '#D97706',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Welcome and empty states
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  
  // Custom foods styles
  customFoodsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyCustomFoods: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCustomFoodsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCustomFoodsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  createFirstFoodButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createFirstFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  customFoodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  customFoodInfo: {
    flex: 1,
    marginRight: 12,
  },
  customFoodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  customFoodDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  customFoodNutrition: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  customFoodActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editCustomFoodButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EBF8FF',
    borderRadius: 4,
    marginRight: 8,
  },
  addCustomFoodButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addCustomFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Custom food form styles
  customFoodForm: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupSmall: {
    flex: 1,
    marginRight: 8,
  },
  inputGroupHalf: {
    flex: 1,
    marginRight: 8,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createFoodButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  createFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Modal overlay for plan info
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  // Plan header styles
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  planHeaderLeft: {
    flex: 1,
  },
  planHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  planHeaderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  planInfoButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  planInfoButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  planInfoModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    marginTop: 'auto',
  },
  planInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  planInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  planInfoContent: {
    padding: 20,
  },
  planInfoSection: {
    marginBottom: 20,
  },
  planInfoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  planInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  planInfoLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  planInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  planTip: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  planTipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  planTipText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  imageUploadContainer: {
    marginTop: 8,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  imageUploadButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 120,
  },
  imageButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  imageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 200,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  analyzingText: {
    color: '#10B981',
    fontSize: 14,
  },
  quantityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  quantityModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  quantityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  quantityModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  quantityModalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  quantityModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  quantityModalCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  quantityModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  quantityModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})