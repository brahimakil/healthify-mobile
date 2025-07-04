import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';
import { MainLayout } from '../../layouts/MainLayout';
import { PlanGenerationService } from '../../services/planGenerationService';
import { sleepService } from '../../services/sleepService';
import {
  DailySleepSummary,
  WeeklySleepStats
} from '../../types/sleep';

// Import Picker properly
import { Picker } from '@react-native-picker/picker';

// Add conditional import for DateTimePicker
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

interface TimePickerState {
  show: boolean;
  field: 'bedtime' | 'wakeTime';
  hours: number;
  minutes: number;
}

export default function SleepScreen() {
  const { user, logout } = useAuth();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [weeklyStats, setWeeklyStats] = useState<WeeklySleepStats | null>(null);
  const [todaysSummary, setTodaysSummary] = useState<DailySleepSummary | null>(null);
  const [showAddSleepModal, setShowAddSleepModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [showPlanInfo, setShowPlanInfo] = useState(false)
  const [showInsightsModal, setShowInsightsModal] = useState(false)
  const [sleepInsights, setSleepInsights] = useState<any>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  
  // Form data with proper default times
  const [sleepFormData, setSleepFormData] = useState(() => {
    const bedtime = new Date();
    bedtime.setHours(22, 30, 0, 0); // 10:30 PM
    
    const wakeTime = new Date();
    wakeTime.setHours(7, 0, 0, 0); // 7:00 AM
    
    return {
      bedtime,
      wakeTime,
      quality: 3,
      notes: ''
    };
  });

  const [timePicker, setTimePicker] = useState<TimePickerState>({
    show: false,
    field: 'bedtime',
    hours: 22,
    minutes: 0
  });

  // Navigation handler for MainLayout
  const handleNavigate = (route: string) => {
    console.log('Navigating to:', route);
    switch (route) {
      case 'dashboard':
        router.push('/(auth)/dashboard');
        break
      case 'nutrition':
        router.push('/(auth)/nutrition');
        break
      case 'workouts':
        router.push('/(auth)/workouts');
        break
      case 'sleep':
        // Already on sleep page
        break
      case 'hydration':
        router.push('/(auth)/hydration');
        break
      case 'dietitians':
        router.push('/(auth)/dietitians');
        break
      case 'settings':
        router.push('/(auth)/settings');
        break
      default:
        console.log('Unknown route:', route);
    }
  };

  // Get current day of week
  const getCurrentDayOfWeek = (): DayOfWeek => {
    const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    return days[today];
  };

  // Load initial data
  useEffect(() => {
    if (user?.uid) {
      loadSleepData();
    }
  }, [user?.uid]);

  const loadSleepData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      console.log('🛌 Loading sleep data...');
      
      // Load today's summary
      const summary = await sleepService.getTodaysSleepSummary(user.uid);
      setTodaysSummary(summary);
      console.log('📊 Today\'s summary loaded:', summary);
      
      // Load weekly stats
      const stats = await sleepService.getWeeklySleepStats(user.uid);
      setWeeklyStats(stats);
      console.log('📈 Weekly stats loaded:', stats);
      
      // Set current day as selected
      setSelectedDay(getCurrentDayOfWeek());
      
    } catch (error) {
      console.error('❌ Error loading sleep data:', error);
      Alert.alert('Error', 'Failed to load sleep data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const loadSleepInsights = async () => {
    if (!user?.uid) return
    
    try {
      setInsightsLoading(true)
      console.log('📊 Loading sleep insights...')
      
      // Get sleep data for the last 30 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      const sleepEntries = await sleepService.getSleepHistory(user.uid, startDate, endDate)
      console.log('📈 Sleep entries loaded:', sleepEntries.length)
      
      if (sleepEntries.length === 0) {
        setSleepInsights({
          hasData: false,
          message: "No sleep data available. Start logging your sleep to see insights!"
        })
        return
      }
      
      // Calculate insights
      const totalEntries = sleepEntries.length
      const totalSleep = sleepEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
      const averageSleep = totalSleep / totalEntries
      const averageQuality = sleepEntries.reduce((sum, entry) => sum + entry.quality, 0) / totalEntries
      
      // Find best and worst sleep days
      const sortedByDuration = [...sleepEntries].sort((a, b) => (b.duration || 0) - (a.duration || 0))
      const bestSleep = sortedByDuration[0]
      const worstSleep = sortedByDuration[sortedByDuration.length - 1]
      
      // Quality analysis
      const excellentSleep = sleepEntries.filter(entry => entry.quality >= 4).length
      const poorSleep = sleepEntries.filter(entry => entry.quality <= 2).length
      
      // Sleep consistency (how much sleep varies)
      const sleepTimes = sleepEntries.map(entry => entry.duration || 0)
      const avgDuration = sleepTimes.reduce((sum, time) => sum + time, 0) / sleepTimes.length
      const variance = sleepTimes.reduce((sum, time) => sum + Math.pow(time - avgDuration, 2), 0) / sleepTimes.length
      const consistency = Math.max(0, 100 - (Math.sqrt(variance) / 60 * 10)) // Convert to percentage
      
      // Weekly patterns
      const weekdaySleep = sleepEntries.filter(entry => {
        const day = new Date(entry.date).getDay()
        return day >= 1 && day <= 5 // Monday to Friday
      })
      const weekendSleep = sleepEntries.filter(entry => {
        const day = new Date(entry.date).getDay()
        return day === 0 || day === 6 // Saturday and Sunday
      })
      
      const weekdayAvg = weekdaySleep.length > 0 ? 
        weekdaySleep.reduce((sum, entry) => sum + (entry.duration || 0), 0) / weekdaySleep.length : 0
      const weekendAvg = weekendSleep.length > 0 ? 
        weekendSleep.reduce((sum, entry) => sum + (entry.duration || 0), 0) / weekendSleep.length : 0
      
      // Generate recommendations
      const recommendations = []
      if (averageSleep < 420) { // Less than 7 hours
        recommendations.push("Try to get more sleep - aim for 7-9 hours per night")
      }
      if (averageQuality < 3) {
        recommendations.push("Focus on improving sleep quality with better sleep hygiene")
      }
      if (consistency < 70) {
        recommendations.push("Try to maintain a more consistent sleep schedule")
      }
      if (weekendAvg > weekdayAvg + 60) { // Sleeping 1+ hour more on weekends
        recommendations.push("Consider going to bed earlier on weeknights")
      }
      
      setSleepInsights({
        hasData: true,
        period: `${totalEntries} days`,
        averageSleep: Math.round(averageSleep),
        averageQuality: Math.round(averageQuality * 10) / 10,
        bestSleep: {
          duration: bestSleep.duration,
          date: bestSleep.date,
          quality: bestSleep.quality
        },
        worstSleep: {
          duration: worstSleep.duration,
          date: worstSleep.date,
          quality: worstSleep.quality
        },
        qualityStats: {
          excellent: Math.round((excellentSleep / totalEntries) * 100),
          poor: Math.round((poorSleep / totalEntries) * 100)
        },
        consistency: Math.round(consistency),
        weekdayAvg: Math.round(weekdayAvg),
        weekendAvg: Math.round(weekendAvg),
        recommendations,
        totalEntries
      })
      
      console.log('✅ Sleep insights calculated:', sleepInsights)
      
    } catch (error) {
      console.error('❌ Error loading sleep insights:', error)
      setSleepInsights({
        hasData: false,
        message: "Error loading insights. Please try again."
      })
    } finally {
      setInsightsLoading(false)
    }
  }

  const handleAddSleepEntry = async () => {
    console.log('🚀 SAVE BUTTON PRESSED!');
    console.log('🔍 Current user:', user?.uid);
    console.log('🔍 Saving state:', saving);
    
    if (!user?.uid) {
      console.error('❌ No user authenticated');
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (saving) {
      console.log('⏳ Already saving, skipping...');
      return;
    }

    try {
      setSaving(true);
      console.log('💾 Starting save process...');
      console.log('📝 Form data:', {
        bedtime: sleepFormData.bedtime.toISOString(),
        wakeTime: sleepFormData.wakeTime.toISOString(),
        quality: sleepFormData.quality,
        notes: sleepFormData.notes
      });
      
      // Handle next-day wake time calculation
      let adjustedWakeTime = new Date(sleepFormData.wakeTime);
      const bedtimeMinutes = sleepFormData.bedtime.getHours() * 60 + sleepFormData.bedtime.getMinutes();
      const wakeTimeMinutes = sleepFormData.wakeTime.getHours() * 60 + sleepFormData.wakeTime.getMinutes();
      
      if (wakeTimeMinutes <= bedtimeMinutes) {
        // Wake time is next day
        adjustedWakeTime = new Date(sleepFormData.wakeTime.getTime() + 24 * 60 * 60 * 1000);
        console.log('⏰ Adjusted wake time to next day:', adjustedWakeTime.toISOString());
      }

      const duration = Math.round((adjustedWakeTime.getTime() - sleepFormData.bedtime.getTime()) / (1000 * 60));
      console.log('⏱️ Calculated duration:', duration, 'minutes');
      
      if (duration <= 0) {
        console.error('❌ Invalid duration:', duration);
        Alert.alert('Error', 'Invalid sleep duration. Please check your times.');
        return;
      }

      if (duration > 1440) { // More than 24 hours
        console.error('❌ Duration too long:', duration);
        Alert.alert('Error', 'Sleep duration cannot exceed 24 hours');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      console.log('📅 Date:', today);
      
      const entryData = {
        userId: user.uid,
        date: today,
        bedtime: sleepFormData.bedtime,
        wakeTime: adjustedWakeTime,
        sleepDuration: duration,
        sleepQuality: sleepFormData.quality as 1 | 2 | 3 | 4 | 5,
        notes: sleepFormData.notes.trim() || undefined
      };

      console.log('📤 FINAL DATA TO SAVE:', entryData);
      console.log('🔥 Calling sleepService.addSleepEntry...');
      
      const entryId = await sleepService.addSleepEntry(entryData);
      console.log('✅ SUCCESS! Sleep entry saved with ID:', entryId);
      
      // Reset form and close modal
      setShowAddSleepModal(false);
      
      // Reset form to default values
      const newBedtime = new Date();
      newBedtime.setHours(22, 30, 0, 0);
      const newWakeTime = new Date();
      newWakeTime.setHours(7, 0, 0, 0);
      
      setSleepFormData({
        bedtime: newBedtime,
        wakeTime: newWakeTime,
        quality: 3,
        notes: ''
      });
      
      console.log('🔄 Reloading sleep data...');
      await loadSleepData();
      
      Alert.alert('Success', 'Sleep entry saved successfully!');
      
    } catch (error) {
      console.error('❌ SAVE FAILED:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      let errorMessage = 'Unknown error occurred';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Firebase error: ${error.code}`;
      }
      
      Alert.alert('Save Failed', `Could not save sleep entry: ${errorMessage}`);
    } finally {
      setSaving(false);
      console.log('🏁 Save process completed');
    }
  };

  const formatTime = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    
    if (typeof date === 'string') {
      return date;
    }
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'N/A';
    }
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes: number | undefined): string => {
    if (!minutes || minutes <= 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getQualityLabel = (quality: number): string => {
    switch (quality) {
      case 1: return 'Very Poor';
      case 2: return 'Poor';
      case 3: return 'Fair';
      case 4: return 'Good';
      case 5: return 'Excellent';
      default: return 'Fair';
    }
  };

  const getQualityColor = (quality: number): string => {
    switch (quality) {
      case 1: return '#EF4444';
      case 2: return '#F97316';
      case 3: return '#EAB308';
      case 4: return '#22C55E';
      case 5: return '#059669';
      default: return '#6B7280';
    }
  };

  const showTimePicker = (field: 'bedtime' | 'wakeTime') => {
    console.log('🕐 Showing time picker for field:', field);
    const currentDate = sleepFormData[field];
    setTimePicker({
      show: true,
      field,
      hours: currentDate.getHours(),
      minutes: currentDate.getMinutes()
    });
  };

  const handleTimePickerSave = () => {
    const newTime = new Date();
    newTime.setHours(timePicker.hours, timePicker.minutes, 0, 0);
    
    setSleepFormData(prev => ({
      ...prev,
      [timePicker.field]: newTime
    }));
    
    setTimePicker(prev => ({ ...prev, show: false }));
    console.log('✅ Time saved:', timePicker.field, formatTime(newTime));
  };

  const renderTodaysSummary = () => {
    if (loading) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Sleep</Text>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (!todaysSummary || !todaysSummary.actual) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Sleep</Text>
          <Text style={styles.noDataText}>No sleep data for today</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddSleepModal(true)}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Add Sleep Entry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const { actual } = todaysSummary;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Today's Sleep</Text>
          <View style={[styles.qualityBadge, { backgroundColor: getQualityColor(todaysSummary.qualityScore) }]}>
            <Text style={styles.qualityBadgeText}>{getQualityLabel(Math.round(todaysSummary.qualityScore))}</Text>
          </View>
        </View>
        
        <View style={styles.sleepStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Bedtime</Text>
            <Text style={styles.statValue}>{formatTime(actual.bedtime)}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Wake Time</Text>
            <Text style={styles.statValue}>{formatTime(actual.wakeTime)}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatDuration(actual.sleepDuration)}</Text>
          </View>
        </View>

        {actual.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{actual.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderWeeklyStats = () => {
    if (loading || !weeklyStats) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Overview</Text>
          <Text style={styles.loadingText}>Loading weekly stats...</Text>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Overview</Text>
        
        <View style={styles.weeklyStatsGrid}>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatLabel}>Avg Sleep</Text>
            <Text style={styles.weeklyStatValue}>{formatDuration(weeklyStats.averageSleepDuration)}</Text>
          </View>
          
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatLabel}>Avg Quality</Text>
            <Text style={styles.weeklyStatValue}>{weeklyStats.averageQuality.toFixed(1)}/5</Text>
          </View>
          
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatLabel}>Sleep Days</Text>
            <Text style={styles.weeklyStatValue}>{weeklyStats.dailySummaries.filter(d => d.actual).length}/7</Text>
          </View>
          
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatLabel}>Adherence</Text>
            <Text style={styles.weeklyStatValue}>{Math.round(weeklyStats.adherencePercentage)}%</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTimePickerModal = () => (
    <Modal
      visible={timePicker.show}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
    >
      <SafeAreaView style={styles.timePickerContainer}>
        <View style={styles.timePickerHeader}>
          <TouchableOpacity onPress={() => setTimePicker(prev => ({ ...prev, show: false }))}>
            <Text style={styles.timePickerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.timePickerTitle}>
            Select {timePicker.field === 'bedtime' ? 'Bedtime' : 'Wake Time'}
          </Text>
          <TouchableOpacity onPress={handleTimePickerSave}>
            <Text style={styles.timePickerSave}>Done</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.timePickerContent}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Hours</Text>
              <Picker
                selectedValue={timePicker.hours}
                style={styles.picker}
                onValueChange={(value) => setTimePicker(prev => ({ ...prev, hours: value }))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <Picker.Item 
                    key={i} 
                    label={i.toString().padStart(2, '0')} 
                    value={i} 
                  />
                ))}
              </Picker>
            </View>
            
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Minutes</Text>
              <Picker
                selectedValue={timePicker.minutes}
                style={styles.picker}
                onValueChange={(value) => setTimePicker(prev => ({ ...prev, minutes: value }))}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <Picker.Item 
                    key={i} 
                    label={i.toString().padStart(2, '0')} 
                    value={i} 
                  />
                ))}
              </Picker>
            </View>
          </View>
          
          <View style={styles.timeDisplay}>
            <Text style={styles.timeDisplayText}>
              {timePicker.hours.toString().padStart(2, '0')}:{timePicker.minutes.toString().padStart(2, '0')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderAddSleepModal = () => (
    <Modal
      visible={showAddSleepModal}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddSleepModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Sleep Entry</Text>
            <TouchableOpacity 
              onPress={handleAddSleepEntry} 
              disabled={saving}
              style={saving ? { opacity: 0.5 } : {}}
            >
              <Text style={[styles.modalSaveText, saving && styles.disabledText]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Bedtime</Text>
              <TouchableOpacity
                style={styles.timeInput}
                onPress={() => showTimePicker('bedtime')}
              >
                <Text style={styles.timeInputText}>{formatTime(sleepFormData.bedtime)}</Text>
                <Ionicons name="time-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Wake Time</Text>
              <TouchableOpacity
                style={styles.timeInput}
                onPress={() => showTimePicker('wakeTime')}
              >
                <Text style={styles.timeInputText}>{formatTime(sleepFormData.wakeTime)}</Text>
                <Ionicons name="time-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Sleep Quality</Text>
              <View style={styles.qualitySelector}>
                {[1, 2, 3, 4, 5].map((quality) => (
                  <TouchableOpacity
                    key={quality}
                    style={[
                      styles.qualityOption,
                      sleepFormData.quality === quality && styles.qualityOptionSelected
                    ]}
                    onPress={() => setSleepFormData(prev => ({ ...prev, quality }))}
                  >
                    <Text style={[
                      styles.qualityOptionText,
                      sleepFormData.quality === quality && styles.qualityOptionTextSelected
                    ]}>
                      {quality}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.qualityLabel}>{getQualityLabel(sleepFormData.quality)}</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="How was your sleep? Any factors that affected it?"
                value={sleepFormData.notes}
                onChangeText={(text) => setSleepFormData(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
              />
            </View>
            
            {/* Add bottom padding for safe scrolling */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Add sleep tips function
  const getSleepTips = (healthGoal: string): string[] => {
    const tips = {
      'Lose Weight': [
        'Aim for 7-9 hours of sleep for weight management',
        'Poor sleep affects hunger hormones',
        'Avoid late-night eating'
      ],
      'Gain Weight': [
        'Quality sleep supports muscle recovery',
        '7-9 hours helps with appetite regulation',
        'Sleep aids protein synthesis'
      ],
      'Build Muscle': [
        'Sleep is crucial for muscle recovery',
        'Growth hormone peaks during deep sleep',
        'Aim for consistent sleep schedule'
      ],
      'Improve Fitness': [
        'Recovery happens during sleep',
        'Better sleep improves workout performance',
        'Maintain regular sleep pattern'
      ],
    }
    return tips[healthGoal as keyof typeof tips] || []
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
            <Text style={styles.planInfoTitle}>Your Sleep Plan</Text>
            <TouchableOpacity onPress={() => setShowPlanInfo(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          {currentPlan && (
            <ScrollView style={styles.planInfoContent}>
              <View style={styles.planInfoSection}>
                <Text style={styles.planInfoSectionTitle}>Health Goal: {currentPlan.healthGoal}</Text>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Recommended Sleep:</Text>
                  <Text style={styles.planInfoValue}>{currentPlan.sleepGoal} hours</Text>
                </View>
                
                <View style={styles.planInfoItem}>
                  <Text style={styles.planInfoLabel}>Suggested Bedtime:</Text>
                  <Text style={styles.planInfoValue}>10:00 - 11:00 PM</Text>
                </View>
              </View>
              
              <View style={styles.planTips}>
                <Text style={styles.planTipsTitle}>😴 Sleep Tips</Text>
                {getSleepTips(currentPlan.healthGoal).map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipBullet}>•</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )

  const SleepInsightsModal = () => (
    <Modal
      visible={showInsightsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowInsightsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.insightsModal}>
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsTitle}>Sleep Insights</Text>
            <TouchableOpacity onPress={() => setShowInsightsModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.insightsContent} showsVerticalScrollIndicator={false}>
            {insightsLoading ? (
              <View style={styles.insightsLoading}>
                <Ionicons name="analytics-outline" size={48} color="#8B5CF6" />
                <Text style={styles.insightsLoadingText}>Analyzing your sleep patterns...</Text>
              </View>
            ) : !sleepInsights?.hasData ? (
              <View style={styles.insightsEmpty}>
                <Ionicons name="bed-outline" size={48} color="#D1D5DB" />
                <Text style={styles.insightsEmptyTitle}>No Sleep Data</Text>
                <Text style={styles.insightsEmptyText}>
                  {sleepInsights?.message || "Start logging your sleep to see insights!"}
                </Text>
              </View>
            ) : (
              <>
                {/* Overview Stats */}
                <View style={styles.insightsSection}>
                  <Text style={styles.insightsSectionTitle}>📊 Overview ({sleepInsights.period})</Text>
                  <View style={styles.insightsGrid}>
                   
                    <View style={styles.insightCard}>
                      <Text style={styles.insightCardValue}>{sleepInsights.averageQuality}/5</Text>
                      <Text style={styles.insightCardLabel}>Avg Quality</Text>
                    </View>
                    <View style={styles.insightCard}>
                      <Text style={styles.insightCardValue}>{sleepInsights.consistency}%</Text>
                      <Text style={styles.insightCardLabel}>Consistency</Text>
                    </View>
                  </View>
                </View>

        

                {/* Quality Distribution */}
                <View style={styles.insightsSection}>
                  <Text style={styles.insightsSectionTitle}>⭐ Sleep Quality</Text>
                  <View style={styles.qualityStatsContainer}>
                    <View style={styles.qualityStatItem}>
                      <Text style={styles.qualityStatValue}>{sleepInsights.qualityStats.excellent}%</Text>
                      <Text style={styles.qualityStatLabel}>Excellent Sleep</Text>
                      <Text style={styles.qualityStatSub}>(4-5 stars)</Text>
                    </View>
                    <View style={styles.qualityStatItem}>
                      <Text style={styles.qualityStatValue}>{sleepInsights.qualityStats.poor}%</Text>
                      <Text style={styles.qualityStatLabel}>Poor Sleep</Text>
                      <Text style={styles.qualityStatSub}>(1-2 stars)</Text>
                    </View>
                  </View>
                </View>

             

                {/* Recommendations */}
                {sleepInsights.recommendations.length > 0 && (
                  <View style={styles.insightsSection}>
                    <Text style={styles.insightsSectionTitle}>💡 Recommendations</Text>
                    {sleepInsights.recommendations.map((rec, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <Text style={styles.recommendationBullet}>•</Text>
                        <Text style={styles.recommendationText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                <View style={{ height: 20 }} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  return (
    <ProtectedRoute>
      <MainLayout
        title="Sleep"
        activeRoute="sleep"
        onNavigate={handleNavigate}
        onLogout={logout}
        user={user}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Add Plan Info Header */}
          {currentPlan && (
            <View style={styles.planHeader}>
              <View style={styles.planHeaderLeft}>
                <Text style={styles.planHeaderTitle}>Plan: {currentPlan.healthGoal}</Text>
                <Text style={styles.planHeaderSubtitle}>
                  Target: {currentPlan.sleepGoal} hours per night
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

          {renderTodaysSummary()}
          {renderWeeklyStats()}

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setShowAddSleepModal(true)}
            >
              <Ionicons name="bed-outline" size={24} color="#3B82F6" />
              <Text style={styles.quickActionText}>Log Sleep</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                setShowInsightsModal(true)
                loadSleepInsights()
              }}
            >
              <Ionicons name="analytics-outline" size={24} color="#10B981" />
              <Text style={styles.quickActionText}>View Insights</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {renderAddSleepModal()}
        {renderTimePickerModal()}
        
        {/* Add Plan Info Modal */}
        <PlanInfoModal />
        <SleepInsightsModal />
      </MainLayout>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButtonHeader: {
    backgroundColor: '#3B82F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  qualityBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  sleepStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  weeklyStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  weeklyStatItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  weeklyStatValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  quickActionButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    width: '100%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeInputText: {
    fontSize: 16,
    color: '#1F2937',
  },
  qualitySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  qualityOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  qualityOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  qualityOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  qualityOptionTextSelected: {
    color: 'white',
  },
  qualityLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Time Picker Styles
  timePickerContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  timePickerCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  timePickerSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  timePickerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerColumn: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  picker: {
    width: 100,
    height: 200,
  },
  timeDisplay: {
    marginTop: 30,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  timeDisplayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
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
    backgroundColor: '#8B5CF6',
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
  planTips: {
    backgroundColor: '#F3E8FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  planTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: '#8B5CF6',
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: '#6B46C1',
    lineHeight: 20,
    flex: 1,
  },
  insightsModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    marginTop: 'auto',
    width: '100%',
  },
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  insightsContent: {
    flex: 1,
    padding: 20,
  },
  insightsLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  insightsLoadingText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginTop: 16,
  },
  insightsEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  insightsEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  insightsEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  insightsSection: {
    marginBottom: 24,
  },
  insightsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  insightsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  insightCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  insightCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  insightCardLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  bestWorstContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bestWorstCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  bestWorstTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  bestWorstValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 4,
  },
  bestWorstDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  bestWorstQuality: {
    fontSize: 12,
    color: '#059669',
  },
  qualityStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qualityStatItem: {
    alignItems: 'center',
  },
  qualityStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  qualityStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  qualityStatSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  weekdayWeekendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekdayWeekendItem: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 8,
  },
  weekdayWeekendLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E',
    marginBottom: 4,
  },
  weekdayWeekendValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B45309',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#0EA5E9',
    marginRight: 8,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    color: '#0C4A6E',
    lineHeight: 20,
    flex: 1,
  },
});