import { router } from 'expo-router'
import { collection, getDocs, query, where } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import {
  ChevronRightIcon,
  NutritionIcon,
  PlusIcon,
  SleepIcon,
  WaterIcon,
  WorkoutIcon
} from '../../components/icons/IconComponents'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'
import { MainLayout } from '../../layouts/MainLayout'
import { HydrationService } from '../../services/hydrationService'
import { NutritionService } from '../../services/nutritionService'
import { SleepService } from '../../services/sleepService'
import { workoutService } from '../../services/workoutService'
import { db } from '../../utils/firebase'

const { width } = Dimensions.get('window')

const quickActions = [
  {
    id: 'log-meal',
    title: 'Log Meal',
    subtitle: 'Track nutrition',
    icon: NutritionIcon,
    color: '#EF4444',
    bgColor: '#FEF2F2',
    action: 'log_meal'
  },
  {
    id: 'log-water',
    title: 'Log Water',
    subtitle: 'Add hydration',
    icon: WaterIcon,
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    action: 'log_water'
  },
  {
    id: 'log-workout',
    title: 'Start Workout',
    subtitle: 'Record exercise',
    icon: WorkoutIcon,
    color: '#10B981',
    bgColor: '#F0FDF4',
    action: 'log_workout'
  },
  {
    id: 'log-sleep',
    title: 'Log Sleep',
    subtitle: 'Track rest',
    icon: SleepIcon,
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    action: 'log_sleep'
  },
]

interface DashboardStats {
  calories: {
    value: number
    target: number
    progress: number
  }
  water: {
    value: number
    target: number
    progress: number
  }
  sleep: {
    value: number
    target: number
    progress: number
  }
  workouts: {
    count: number
    duration: number
    calories: number
  }
}

interface RecentActivity {
  id: string
  type: 'water' | 'meal' | 'workout' | 'sleep'
  title: string
  time: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    calories: { value: 0, target: 2000, progress: 0 },
    water: { value: 0, target: 2000, progress: 0 },
    sleep: { value: 0, target: 8, progress: 0 },
    workouts: { count: 0, duration: 0, calories: 0 }
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])

  useEffect(() => {
    if (user?.uid) {
      loadDashboardData()
    }
  }, [user?.uid])

  const loadDashboardData = async () => {
    if (!user) return

    setLoading(true)

    try {
      const today = new Date()
      const dateString = today.toISOString().split('T')[0]

      let caloriesConsumed = 0
      let caloriesTarget = 2000
      let waterConsumed = 0
      let waterTarget = 2000
      let sleepDuration = 0
      let workoutCount = 0
      let workoutCalories = 0

      // NUTRITION
      try {
        const nutritionSummary = await NutritionService.getDailySummary(user.uid, dateString)
        caloriesConsumed = nutritionSummary.totalNutrition.calories
        caloriesTarget = nutritionSummary.goals?.calorieGoal || 2000
      } catch (error) {
        const startOfDay = new Date(dateString + 'T00:00:00')
        const endOfDay = new Date(dateString + 'T23:59:59')
        
        const mealsQuery = query(
          collection(db, 'mealEntries'),
          where('userId', '==', user.uid),
          where('consumedAt', '>=', startOfDay),
          where('consumedAt', '<=', endOfDay)
        )
        
        const mealsSnapshot = await getDocs(mealsQuery)
        const meals = mealsSnapshot.docs.map(doc => doc.data())
        caloriesConsumed = meals.reduce((total, meal) => {
          return total + (meal.actualNutrition?.calories || 0)
        }, 0)
      }

      // HYDRATION
      try {
        const hydrationSummary = await HydrationService.getDailySummary(user.uid, dateString)
        waterConsumed = hydrationSummary.totalConsumed
        waterTarget = hydrationSummary.targetAmount
      } catch (error) {
        const waterQuery = query(
          collection(db, 'waterEntries'),
          where('userId', '==', user.uid),
          where('date', '==', dateString)
        )
        
        const waterSnapshot = await getDocs(waterQuery)
        const waterEntries = waterSnapshot.docs.map(doc => doc.data())
        
        const DRINK_TYPES = HydrationService.DRINK_TYPES
        
        waterConsumed = waterEntries.reduce((total, entry) => {
          const drinkType = DRINK_TYPES.find(dt => dt.id === entry.drinkType) || DRINK_TYPES[0]
          const effectiveAmount = entry.amount * drinkType.hydrationValue
          return total + effectiveAmount
        }, 0)
        
        try {
          waterTarget = await HydrationService.getUserHydrationGoal(user.uid)
        } catch (goalError) {
          waterTarget = 2000
        }
      }

      // SLEEP
      try {
        const sleepService = new SleepService()
        const sleepSummary = await sleepService.getTodaysSleepSummary(user.uid)
        if (sleepSummary.actual) {
          sleepDuration = sleepSummary.actual.sleepDuration
        }
      } catch (error) {
        const sleepQuery = query(
          collection(db, 'sleepEntries'),
          where('userId', '==', user.uid),
          where('date', '==', dateString)
        )
        
        const sleepSnapshot = await getDocs(sleepQuery)
        if (!sleepSnapshot.empty) {
          const sleepEntry = sleepSnapshot.docs[0].data()
          if (sleepEntry.bedtime && sleepEntry.wakeTime) {
            const bedtime = sleepEntry.bedtime.toDate()
            const wakeTime = sleepEntry.wakeTime.toDate()
            sleepDuration = Math.round((wakeTime.getTime() - bedtime.getTime()) / (1000 * 60))
            if (sleepDuration < 0) {
              sleepDuration += 24 * 60
            }
          }
        }
      }

      // WORKOUTS
      try {
        const workoutSummary = await workoutService.getTodaysWorkoutSummary(user.uid)
        workoutCount = workoutSummary.completedExercises.length
        workoutCalories = workoutSummary.totalCaloriesBurned
      } catch (error) {
        const today = new Date()
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()]
        
        const workoutQuery = query(
          collection(db, 'workoutPlans'),
          where('userId', '==', user.uid)
        )
        
        const workoutSnapshot = await getDocs(workoutQuery)
        if (!workoutSnapshot.empty) {
          const workoutPlan = workoutSnapshot.docs[0].data()
          const dayPlan = workoutPlan.weeklyPlan?.[dayOfWeek.toLowerCase()]
          
          if (dayPlan?.exercises) {
            const completedExercises = dayPlan.exercises.filter(ex => ex.completed)
            workoutCount = completedExercises.length
            workoutCalories = completedExercises.reduce((total, exercise) => {
              const estimatedDuration = exercise.sets * 2
              return total + (estimatedDuration * 5)
            }, 0)
          }
        }
      }

      const finalStats = {
        calories: {
          value: Math.round(caloriesConsumed),
          target: caloriesTarget,
          progress: caloriesTarget > 0 ? Math.min((caloriesConsumed / caloriesTarget) * 100, 100) : 0
        },
        water: {
          value: Math.round(waterConsumed),
          target: waterTarget,
          progress: waterTarget > 0 ? Math.min((waterConsumed / waterTarget) * 100, 100) : 0
        },
        sleep: {
          value: sleepDuration,
          target: 480,
          progress: sleepDuration > 0 ? Math.min((sleepDuration / 480) * 100, 100) : 0
        },
        workouts: {
          count: workoutCount,
          duration: workoutCount * 30,
          calories: workoutCalories
        }
      }

      setStats(finalStats)
      
    } catch (error) {
      // Silent error handling for better UX
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (route: string) => {
    switch (route) {
      case 'nutrition':
        router.push('/(auth)/nutrition')
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
      case 'settings':
        router.push('/settings')
        break
    }
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'log_meal':
        router.push('/(auth)/nutrition')
        break
      case 'log_water':
        router.push('/(auth)/hydration')
        break
      case 'log_workout':
        router.push('/(auth)/workouts')
        break
      case 'log_sleep':
        router.push('/(auth)/sleep')
        break
      default:
        Alert.alert('Coming Soon', 'This feature will be available soon!')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.')
    }
  }

  const formatValue = (category: string, value: number): string => {
    switch (category) {
      case 'calories':
        return `${Math.round(value)}`
      case 'water':
        if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}L`
        }
        return `${value}ml`
      case 'sleep':
        if (!value || value <= 0) return '0h 0m'
        const hours = Math.floor(value / 60)
        const mins = value % 60
        return `${hours}h ${mins}m`
      case 'workouts':
        return `${Math.round(value)} cal`
      default:
        return value.toString()
    }
  }

  const formatTarget = (category: string, value: number): string => {
    switch (category) {
      case 'calories':
        return `${Math.round(value)} cal goal`
      case 'water':
        if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}L goal`
        }
        return `${value}ml goal`
      case 'sleep':
        const hours = Math.floor(value / 60)
        const mins = value % 60
        return `${hours}h ${mins}m goal`
      case 'workouts':
        return `${Math.round(value)} cal goal`
      default:
        return `${value} goal`
    }
  }

  const quickStats = [
    {
      id: 'calories',
      title: 'Calories',
      value: formatValue('calories', stats.calories.value),
      target: formatTarget('calories', stats.calories.target),
      progress: stats.calories.progress,
      color: '#EF4444',
    },
    {
      id: 'water',
      title: 'Water',
      value: formatValue('water', stats.water.value),
      target: formatTarget('water', stats.water.target),
      progress: stats.water.progress,
      color: '#3B82F6',
    },
    {
      id: 'sleep',
      title: 'Sleep',
      value: formatValue('sleep', stats.sleep.value),
      target: formatTarget('sleep', stats.sleep.target),
      progress: stats.sleep.progress,
      color: '#8B5CF6',
    },
  ]

  return (
    <ProtectedRoute>
      <MainLayout
        title="Dashboard"
        activeRoute="dashboard"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={{
          name: user?.displayName || 'User',
          email: user?.email || '',
          photoURL: user?.photoURL
        }}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome back! 👋</Text>
            <Text style={styles.welcomeSubtitle}>
              {user?.displayName ? `${user.displayName}, here's` : "Here's"} your health summary for today
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action) => {
                const IconComponent = action.icon
                return (
                  <TouchableOpacity
                    key={action.id}
                    style={[styles.quickActionCard, { backgroundColor: action.bgColor }]}
                    onPress={() => handleQuickAction(action.action)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.quickActionContent}>
                      <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                        <IconComponent size={22} color="#ffffff" />
                      </View>
                      <View style={styles.quickActionText}>
                        <Text style={[styles.quickActionTitle, { color: action.color }]}>
                          {action.title}
                        </Text>
                        <Text style={styles.quickActionSubtitle}>
                          {action.subtitle}
                        </Text>
                      </View>
                      <PlusIcon size={18} color={action.color} />
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Daily Progress Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Progress</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading your progress...</Text>
              </View>
            ) : (
              <View style={styles.statsContainer}>
                <View style={styles.statsGrid}>
                  {quickStats.map((stat) => (
                    <TouchableOpacity 
                      key={stat.id} 
                      style={styles.statCard}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.progressCircle, { borderColor: stat.color }]}>
                        <Text style={[styles.progressText, { color: stat.color }]}>
                          {Math.round(stat.progress)}%
                        </Text>
                      </View>
                      <Text style={styles.statTitle}>{stat.title}</Text>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text style={styles.statTarget}>of {stat.target}</Text>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${Math.min(stat.progress, 100)}%`, backgroundColor: stat.color }
                          ]} 
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Workout Summary Card */}
                <TouchableOpacity 
                  style={styles.workoutCard}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/workouts')}
                >
                  <View style={styles.workoutHeader}>
                    <View style={[styles.workoutIcon, { backgroundColor: '#F0FDF4' }]}>
                      <WorkoutIcon size={24} color="#10B981" />
                    </View>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutTitle}>Today's Workouts</Text>
                      <Text style={styles.workoutSubtitle}>
                        {stats.workouts.count} {stats.workouts.count === 1 ? 'exercise' : 'exercises'} completed
                      </Text>
                    </View>
                    <ChevronRightIcon size={20} color="#6B7280" />
                  </View>
                  <View style={styles.workoutStats}>
                    <View style={styles.workoutStat}>
                      <Text style={styles.workoutStatValue}>{stats.workouts.duration}min</Text>
                      <Text style={styles.workoutStatLabel}>Duration</Text>
                    </View>
                    <View style={styles.workoutStat}>
                      <Text style={styles.workoutStatValue}>{stats.workouts.calories}</Text>
                      <Text style={styles.workoutStatLabel}>Calories</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
                <ChevronRightIcon size={16} color="#10B981" />
              </TouchableOpacity>
            </View>
            <View style={styles.activityList}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading activities...</Text>
                </View>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((activity) => {
                  const IconComponent = activity.icon
                  return (
                    <View key={activity.id} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: activity.bgColor }]}>
                        <IconComponent size={16} color={activity.color} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <Text style={styles.activityTime}>{activity.time}</Text>
                      </View>
                    </View>
                  )
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No recent activity</Text>
                  <Text style={styles.emptyStateSubtext}>Start logging your health data to see activity here</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </MainLayout>
    </ProtectedRoute>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginRight: 4,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionCard: {
    width: (width - 56) / 2,
    marginHorizontal: 4,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  statsContainer: {
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  statCard: {
    width: (width - 56) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  progressCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  progressText: {
    fontSize: 15,
    fontWeight: '800',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  statTarget: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  workoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  workoutSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  workoutStat: {
    alignItems: 'center',
  },
  workoutStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  workoutStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  activityList: {
    gap: 12,
    alignItems: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
}) 