import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import {
    DailySleepPlan,
    DailySleepSummary,
    Nap,
    SleepEntry,
    SleepGoals,
    SleepPattern,
    SleepQualityLabel,
    WeeklySleepPlan,
    WeeklySleepStats
} from '../types/sleep';
import { db } from '../utils/firebase';

class SleepService {
  private readonly SLEEP_ENTRIES_COLLECTION = 'sleepEntries';
  private readonly SLEEP_PLANS_COLLECTION = 'sleepPlans';
  private readonly SLEEP_GOALS_COLLECTION = 'sleepGoals';

  // Helper methods
  private getCurrentDayOfWeek(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private parseTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5); // HH:MM
  }

  private calculateDuration(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
  }

  private getSleepQualityLabel(quality: number): SleepQualityLabel {
    switch (quality) {
      case 1: return 'Very Poor';
      case 2: return 'Poor';
      case 3: return 'Fair';
      case 4: return 'Good';
      case 5: return 'Excellent';
      default: return 'Fair';
    }
  }

  private cleanDataForFirestore<T>(obj: T): T {
    const cleaned = { ...obj };
    Object.keys(cleaned).forEach(key => {
      const value = (cleaned as any)[key];
      if (value === undefined) {
        delete (cleaned as any)[key];
      } else if (value instanceof Date) {
        (cleaned as any)[key] = Timestamp.fromDate(value);
      } else if (Array.isArray(value)) {
        (cleaned as any)[key] = value.map(item => 
          item instanceof Date ? Timestamp.fromDate(item) : 
          typeof item === 'object' ? this.cleanDataForFirestore(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        (cleaned as any)[key] = this.cleanDataForFirestore(value);
      }
    });
    return cleaned;
  }

  // Sleep Entry Management
  async addSleepEntry(entry: Omit<SleepEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const cleanedEntry = this.cleanDataForFirestore({
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const docRef = await addDoc(collection(db, this.SLEEP_ENTRIES_COLLECTION), cleanedEntry);
      return docRef.id;
    } catch (error) {
      console.error('Error adding sleep entry:', error);
      throw error;
    }
  }

  async updateSleepEntry(entryId: string, updates: Partial<SleepEntry>): Promise<void> {
    try {
      const cleanedUpdates = this.cleanDataForFirestore({
        ...updates,
        updatedAt: new Date()
      });

      await updateDoc(doc(db, this.SLEEP_ENTRIES_COLLECTION, entryId), cleanedUpdates);
    } catch (error) {
      console.error('Error updating sleep entry:', error);
      throw error;
    }
  }

  async deleteSleepEntry(entryId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.SLEEP_ENTRIES_COLLECTION, entryId));
    } catch (error) {
      console.error('Error deleting sleep entry:', error);
      throw error;
    }
  }

  async getDailySleepEntry(userId: string, date: string): Promise<SleepEntry | null> {
    try {
      const q = query(
        collection(db, this.SLEEP_ENTRIES_COLLECTION),
        where('userId', '==', userId),
        where('date', '==', date)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        bedtime: data.bedtime.toDate(),
        wakeTime: data.wakeTime.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        naps: data.naps?.map((nap: any) => ({
          ...nap,
          startTime: nap.startTime.toDate(),
          endTime: nap.endTime.toDate()
        })) || []
      } as SleepEntry;
    } catch (error) {
      console.error('Error getting daily sleep entry:', error);
      throw error;
    }
  }

  // Weekly Sleep Plan Management
  async saveWeeklySleepPlan(userId: string, weeklyPlan: WeeklySleepPlan): Promise<void> {
    try {
      const planId = `${userId}_weekly_plan`;
      const cleanedPlan = this.cleanDataForFirestore({
        id: planId,
        userId,
        ...weeklyPlan,
        updatedAt: new Date()
      });

      await setDoc(doc(db, this.SLEEP_PLANS_COLLECTION, planId), cleanedPlan);
    } catch (error) {
      console.error('Error saving weekly sleep plan:', error);
      throw error;
    }
  }

  async getWeeklySleepPlan(userId: string): Promise<WeeklySleepPlan> {
    try {
      const planId = `${userId}_weekly_plan`;
      const docSnap = await getDoc(doc(db, this.SLEEP_PLANS_COLLECTION, planId));
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          monday: { ...data.monday, createdAt: data.monday.createdAt.toDate(), updatedAt: data.monday.updatedAt.toDate() },
          tuesday: { ...data.tuesday, createdAt: data.tuesday.createdAt.toDate(), updatedAt: data.tuesday.updatedAt.toDate() },
          wednesday: { ...data.wednesday, createdAt: data.wednesday.createdAt.toDate(), updatedAt: data.wednesday.updatedAt.toDate() },
          thursday: { ...data.thursday, createdAt: data.thursday.createdAt.toDate(), updatedAt: data.thursday.updatedAt.toDate() },
          friday: { ...data.friday, createdAt: data.friday.createdAt.toDate(), updatedAt: data.friday.updatedAt.toDate() },
          saturday: { ...data.saturday, createdAt: data.saturday.createdAt.toDate(), updatedAt: data.saturday.updatedAt.toDate() },
          sunday: { ...data.sunday, createdAt: data.sunday.createdAt.toDate(), updatedAt: data.sunday.updatedAt.toDate() }
        };
      }

      // Return default plan if none exists
      return this.getDefaultWeeklySleepPlan(userId);
    } catch (error) {
      console.error('Error getting weekly sleep plan:', error);
      return this.getDefaultWeeklySleepPlan(userId);
    }
  }

  private getDefaultWeeklySleepPlan(userId: string): WeeklySleepPlan {
    const createDayPlan = (dayOfWeek: string): DailySleepPlan => ({
      userId,
      dayOfWeek: dayOfWeek as any,
      targetBedtime: '22:30',
      targetWakeTime: '07:00',
      targetSleepDuration: 510, // 8.5 hours
      allowNaps: true,
      maxNapDuration: 30,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      monday: createDayPlan('Monday'),
      tuesday: createDayPlan('Tuesday'),
      wednesday: createDayPlan('Wednesday'),
      thursday: createDayPlan('Thursday'),
      friday: createDayPlan('Friday'),
      saturday: { ...createDayPlan('Saturday'), targetBedtime: '23:00', targetWakeTime: '08:00' },
      sunday: { ...createDayPlan('Sunday'), targetBedtime: '23:00', targetWakeTime: '08:00' }
    };
  }

  async updateDailySleepPlan(
    userId: string,
    dayOfWeek: string,
    updates: Partial<DailySleepPlan>
  ): Promise<void> {
    try {
      const currentPlan = await this.getWeeklySleepPlan(userId);
      const dayKey = dayOfWeek.toLowerCase() as keyof WeeklySleepPlan;
      
      currentPlan[dayKey] = {
        ...currentPlan[dayKey],
        ...updates,
        updatedAt: new Date()
      };

      await this.saveWeeklySleepPlan(userId, currentPlan);
    } catch (error) {
      console.error('Error updating daily sleep plan:', error);
      throw error;
    }
  }

  // Statistics and Analysis
  async getTodaysSleepSummary(userId: string): Promise<DailySleepSummary> {
    const today = this.formatDate(new Date());
    const currentDay = this.getCurrentDayOfWeek();
    
    try {
      const weeklyPlan = await this.getWeeklySleepPlan(userId);
      const planned = weeklyPlan[currentDay.toLowerCase() as keyof WeeklySleepPlan];
      const actual = await this.getDailySleepEntry(userId, today);

      let deviation = {
        bedtime: 0,
        wakeTime: 0,
        duration: 0
      };

      let adherenceScore = 0;
      let qualityScore = 3; // default

      if (actual) {
        const targetBedtime = this.parseTime(planned.targetBedtime);
        const targetWakeTime = this.parseTime(planned.targetWakeTime);

        deviation = {
          bedtime: this.calculateDuration(targetBedtime, actual.bedtime),
          wakeTime: this.calculateDuration(targetWakeTime, actual.wakeTime),
          duration: actual.sleepDuration - planned.targetSleepDuration
        };

        // Calculate adherence score (0-100)
        const bedtimeScore = Math.max(0, 100 - Math.abs(deviation.bedtime) * 2);
        const wakeTimeScore = Math.max(0, 100 - Math.abs(deviation.wakeTime) * 2);
        const durationScore = Math.max(0, 100 - Math.abs(deviation.duration) * 0.5);
        
        adherenceScore = Math.round((bedtimeScore + wakeTimeScore + durationScore) / 3);

        // Calculate quality score including naps
        const napQuality = actual.naps?.length ? 
          actual.naps.reduce((sum, nap) => sum + nap.quality, 0) / actual.naps.length : 0;
        qualityScore = actual.naps?.length ? 
          (actual.sleepQuality + napQuality) / 2 : actual.sleepQuality;
      }

      return {
        date: today,
        dayOfWeek: currentDay,
        planned,
        actual,
        deviation,
        adherenceScore,
        qualityScore
      };
    } catch (error) {
      console.error('Error getting today\'s sleep summary:', error);
      throw error;
    }
  }

  async getWeeklySleepStats(userId: string, weekStartDate?: string): Promise<WeeklySleepStats> {
    try {
      const startDate = weekStartDate ? new Date(weekStartDate) : this.getWeekStartDate();
      const weekString = this.formatDate(startDate);
      
      const dailySummaries: DailySleepSummary[] = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateString = this.formatDate(date);
        const dayOfWeek = days[i];
        
        const weeklyPlan = await this.getWeeklySleepPlan(userId);
        const planned = weeklyPlan[dayOfWeek.toLowerCase() as keyof WeeklySleepPlan];
        const actual = await this.getDailySleepEntry(userId, dateString);

        let deviation = { bedtime: 0, wakeTime: 0, duration: 0 };
        let adherenceScore = 0;
        let qualityScore = 3;

        if (actual) {
          const targetBedtime = this.parseTime(planned.targetBedtime);
          const targetWakeTime = this.parseTime(planned.targetWakeTime);

          deviation = {
            bedtime: this.calculateDuration(targetBedtime, actual.bedtime),
            wakeTime: this.calculateDuration(targetWakeTime, actual.wakeTime),
            duration: actual.sleepDuration - planned.targetSleepDuration
          };

          const bedtimeScore = Math.max(0, 100 - Math.abs(deviation.bedtime) * 2);
          const wakeTimeScore = Math.max(0, 100 - Math.abs(deviation.wakeTime) * 2);
          const durationScore = Math.max(0, 100 - Math.abs(deviation.duration) * 0.5);
          adherenceScore = Math.round((bedtimeScore + wakeTimeScore + durationScore) / 3);

          const napQuality = actual.naps?.length ? 
            actual.naps.reduce((sum, nap) => sum + nap.quality, 0) / actual.naps.length : 0;
          qualityScore = actual.naps?.length ? 
            (actual.sleepQuality + napQuality) / 2 : actual.sleepQuality;
        }

        dailySummaries.push({
          date: dateString,
          dayOfWeek,
          planned,
          actual,
          deviation,
          adherenceScore,
          qualityScore
        });
      }

      // Calculate weekly statistics
      const actualEntries = dailySummaries.filter(day => day.actual);
      const totalEntries = actualEntries.length;

      if (totalEntries === 0) {
        return {
          week: weekString,
          averageSleepDuration: 0,
          averageBedtime: '00:00',
          averageWakeTime: '00:00',
          averageQuality: 0,
          totalNaps: 0,
          totalNapDuration: 0,
          adherencePercentage: 0,
          sleepDebt: 0,
          consistency: {
            bedtimeVariance: 0,
            wakeTimeVariance: 0,
            durationVariance: 0
          },
          dailySummaries
        };
      }

      const averageSleepDuration = Math.round(
        actualEntries.reduce((sum, day) => sum + day.actual!.sleepDuration, 0) / totalEntries
      );

      const bedtimes = actualEntries.map(day => day.actual!.bedtime.getHours() * 60 + day.actual!.bedtime.getMinutes());
      const wakeTimes = actualEntries.map(day => day.actual!.wakeTime.getHours() * 60 + day.actual!.wakeTime.getMinutes());
      const durations = actualEntries.map(day => day.actual!.sleepDuration);

      const averageBedtimeMinutes = Math.round(bedtimes.reduce((sum, time) => sum + time, 0) / totalEntries);
      const averageWakeTimeMinutes = Math.round(wakeTimes.reduce((sum, time) => sum + time, 0) / totalEntries);

      const averageBedtime = `${Math.floor(averageBedtimeMinutes / 60).toString().padStart(2, '0')}:${(averageBedtimeMinutes % 60).toString().padStart(2, '0')}`;
      const averageWakeTime = `${Math.floor(averageWakeTimeMinutes / 60).toString().padStart(2, '0')}:${(averageWakeTimeMinutes % 60).toString().padStart(2, '0')}`;

      const averageQuality = actualEntries.reduce((sum, day) => sum + day.qualityScore, 0) / totalEntries;

      const totalNaps = actualEntries.reduce((sum, day) => sum + (day.actual!.naps?.length || 0), 0);
      const totalNapDuration = actualEntries.reduce((sum, day) => 
        sum + (day.actual!.naps?.reduce((napSum, nap) => napSum + nap.duration, 0) || 0), 0
      );

      const adherencePercentage = Math.round(
        actualEntries.reduce((sum, day) => sum + day.adherenceScore, 0) / totalEntries
      );

      const targetDuration = dailySummaries[0].planned.targetSleepDuration;
      const sleepDebt = actualEntries.reduce((debt, day) => 
        debt + Math.max(0, targetDuration - day.actual!.sleepDuration), 0
      );

      // Calculate variance for consistency
      const bedtimeVariance = this.calculateVariance(bedtimes);
      const wakeTimeVariance = this.calculateVariance(wakeTimes);
      const durationVariance = this.calculateVariance(durations);

      return {
        week: weekString,
        averageSleepDuration,
        averageBedtime,
        averageWakeTime,
        averageQuality: Math.round(averageQuality * 10) / 10,
        totalNaps,
        totalNapDuration,
        adherencePercentage,
        sleepDebt,
        consistency: {
          bedtimeVariance: Math.round(bedtimeVariance),
          wakeTimeVariance: Math.round(wakeTimeVariance),
          durationVariance: Math.round(durationVariance)
        },
        dailySummaries
      };
    } catch (error) {
      console.error('Error getting weekly sleep stats:', error);
      throw error;
    }
  }

  private getWeekStartDate(date: Date = new Date()): Date {
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  // Nap Management
  async addNap(userId: string, date: string, nap: Omit<Nap, 'id'>): Promise<void> {
    try {
      const sleepEntry = await this.getDailySleepEntry(userId, date);
      
      if (!sleepEntry) {
        throw new Error('No sleep entry found for this date');
      }

      const newNap: Nap = {
        ...nap,
        id: Date.now().toString()
      };

      const updatedNaps = [...(sleepEntry.naps || []), newNap];
      
      await this.updateSleepEntry(sleepEntry.id!, {
        naps: updatedNaps
      });
    } catch (error) {
      console.error('Error adding nap:', error);
      throw error;
    }
  }

  async removeNap(userId: string, date: string, napId: string): Promise<void> {
    try {
      const sleepEntry = await this.getDailySleepEntry(userId, date);
      
      if (!sleepEntry) {
        throw new Error('No sleep entry found for this date');
      }

      const updatedNaps = sleepEntry.naps?.filter(nap => nap.id !== napId) || [];
      
      await this.updateSleepEntry(sleepEntry.id!, {
        naps: updatedNaps
      });
    } catch (error) {
      console.error('Error removing nap:', error);
      throw error;
    }
  }

  // Sleep Goals Management
  async setSleepGoals(goals: Omit<SleepGoals, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const goalsId = `${goals.userId}_goals`;
      const cleanedGoals = this.cleanDataForFirestore({
        ...goals,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await setDoc(doc(db, this.SLEEP_GOALS_COLLECTION, goalsId), cleanedGoals);
    } catch (error) {
      console.error('Error setting sleep goals:', error);
      throw error;
    }
  }

  async getSleepGoals(userId: string): Promise<SleepGoals | null> {
    try {
      const goalsId = `${userId}_goals`;
      const docSnap = await getDoc(doc(db, this.SLEEP_GOALS_COLLECTION, goalsId));
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as SleepGoals;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting sleep goals:', error);
      throw error;
    }
  }

  // Analysis and Recommendations
  async getSleepPattern(userId: string, days: number = 30): Promise<SleepPattern> {
    try {
      // This would typically analyze the last N days of sleep data
      // For now, returning basic pattern analysis
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      // In a real implementation, you'd query multiple days and analyze patterns
      const todaysSummary = await this.getTodaysSleepSummary(userId);
      
      return {
        averageBedtime: todaysSummary.planned.targetBedtime,
        averageWakeTime: todaysSummary.planned.targetWakeTime,
        averageDuration: todaysSummary.planned.targetSleepDuration,
        consistency: 'Good',
        recommendations: [
          'Try to maintain consistent sleep and wake times',
          'Consider limiting screen time before bed',
          'Create a relaxing bedtime routine'
        ]
      };
    } catch (error) {
      console.error('Error analyzing sleep pattern:', error);
      throw error;
    }
  }
}

export const sleepService = new SleepService(); 