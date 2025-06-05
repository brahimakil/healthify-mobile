export interface SleepEntry {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  bedtime: Date;
  wakeTime: Date;
  sleepDuration: number; // in minutes
  sleepQuality: 1 | 2 | 3 | 4 | 5; // 1 = Very Poor, 5 = Excellent
  naps?: Nap[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Nap {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  quality: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface DailySleepPlan {
  id?: string;
  userId: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  targetBedtime: string; // HH:MM format (e.g., "22:30")
  targetWakeTime: string; // HH:MM format
  targetSleepDuration: number; // in minutes
  allowNaps: boolean;
  maxNapDuration?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklySleepPlan {
  monday: DailySleepPlan;
  tuesday: DailySleepPlan;
  wednesday: DailySleepPlan;
  thursday: DailySleepPlan;
  friday: DailySleepPlan;
  saturday: DailySleepPlan;
  sunday: DailySleepPlan;
}

export interface DailySleepSummary {
  date: string;
  dayOfWeek: string;
  planned: DailySleepPlan;
  actual?: SleepEntry;
  deviation: {
    bedtime: number; // minutes late/early (positive = late)
    wakeTime: number; // minutes late/early
    duration: number; // minutes more/less than target
  };
  adherenceScore: number; // 0-100 percentage
  qualityScore: number; // 1-5 average including naps
}

export interface WeeklySleepStats {
  week: string; // Week starting date (YYYY-MM-DD)
  averageSleepDuration: number; // in minutes
  averageBedtime: string; // HH:MM
  averageWakeTime: string; // HH:MM
  averageQuality: number; // 1-5
  totalNaps: number;
  totalNapDuration: number; // in minutes
  adherencePercentage: number; // How well user followed their plan
  sleepDebt: number; // Cumulative minutes of sleep deficit
  consistency: {
    bedtimeVariance: number; // Standard deviation in minutes
    wakeTimeVariance: number; // Standard deviation in minutes
    durationVariance: number; // Standard deviation in minutes
  };
  dailySummaries: DailySleepSummary[];
}

export interface SleepGoals {
  userId: string;
  targetSleepDuration: number; // in minutes (e.g., 480 = 8 hours)
  targetBedtime: string; // HH:MM
  targetWakeTime: string; // HH:MM
  maxNapsPerDay: number;
  maxNapDuration: number; // in minutes
  consistencyGoal: number; // Target variance in minutes
  qualityGoal: number; // Target average quality (1-5)
  createdAt: Date;
  updatedAt: Date;
}

// Helper types for sleep analysis
export type SleepQualityLabel = 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent';

export interface SleepPattern {
  averageBedtime: string;
  averageWakeTime: string;
  averageDuration: number;
  consistency: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendations: string[];
} 