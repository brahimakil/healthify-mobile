import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore'
import { User, UserDocument } from '../types/user'
import { db } from '../utils/firebase'

const USERS_COLLECTION = 'users'

export class UserService {
  static async createUser(uid: string, userData: Partial<UserDocument>): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, uid)
    
    const defaultProfile = {
      name: userData.displayName || '',
      activityLevel: 'moderate' as const,
      dailyCalorieTarget: 2000,
      dailyWaterTarget: 2000, // 2L
      sleepDurationTarget: 8,
      weeklyWorkoutTarget: 3,
    }

    const userDoc: UserDocument = {
      email: userData.email || '',
      displayName: userData.displayName || '',
      photoURL: userData.photoURL || '',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        ...defaultProfile,
        ...userData.profile,
      }
    }

    await setDoc(userRef, {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  static async getUser(uid: string): Promise<User | null> {
    const userRef = doc(db, USERS_COLLECTION, uid)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      const data = userSnap.data() as UserDocument
      return {
        id: userSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(),
      }
    }
    
    return null
  }

  static async updateUser(uid: string, updates: Partial<UserDocument>): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, uid)
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  }

  static async updateUserProfile(uid: string, profileUpdates: Partial<User['profile']>): Promise<void> {
    try {
      // First get the current user data
      const currentUser = await this.getUser(uid);
      
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Merge the profile updates with existing profile
      const updatedProfile = {
        ...currentUser.profile,
        ...profileUpdates
      };

      const userRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(userRef, {
        profile: updatedProfile,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ User profile updated successfully');
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  }

  // Base64 document upload utility
  static async uploadDocument(uid: string, documentData: string, documentType: string): Promise<string> {
    // Store as base64 URL in Firestore
    const documentRef = doc(collection(db, 'documents'))
    const documentUrl = `data:${documentType};base64,${documentData}`
    
    await setDoc(documentRef, {
      userId: uid,
      documentUrl,
      documentType,
      uploadedAt: serverTimestamp(),
    })
    
    return documentRef.id
  }
} 