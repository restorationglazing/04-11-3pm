import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { type CaloriePreferences } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyDCyZX1BlQXRnQ92xf-s-fHlMrsG4Dxmng",
  authDomain: "cellular-unity-440317-d2.firebaseapp.com",
  projectId: "cellular-unity-440317-d2",
  storageBucket: "cellular-unity-440317-d2.firebasestorage.app",
  messagingSenderId: "611379941787",
  appId: "1:611379941787:web:2dd7a30444ad7bef99d13e",
  measurementId: "G-EG4PVSJQ84"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export interface UserData {
  username: string;
  email: string;
  isPremium: boolean;
  premiumSince?: string;
  stripeSessionId?: string;
  stripeSubscriptionActive?: boolean;
  stripeCustomerId?: string;
  savedRecipes: any[];
  mealPlans: any[];
  preferences: {
    dietaryRestrictions: string[];
    servingSize: number;
    theme: 'light' | 'dark';
    caloriePreferences?: CaloriePreferences;
  };
  lastVerified?: string;
  createdAt: string;
  updatedAt: string;
}

export const getUserData = async (userId: string, forceRefresh = false): Promise<UserData> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data() as UserData;
    
    if (forceRefresh) {
      const verificationResult = await verifyPremiumStatus(userId);
      if (verificationResult.isPremium !== userData.isPremium) {
        await updateDoc(userRef, {
          isPremium: verificationResult.isPremium,
          lastVerified: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        return { ...userData, isPremium: verificationResult.isPremium };
      }
    }
    
    return userData;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

export const addPremiumUser = async (email: string) => {
  if (!email) {
    throw new Error('Email is required');
  }

  try {
    const normalizedEmail = email.toLowerCase();
    
    if (!auth.currentUser) {
      throw new Error('No authenticated user found');
    }

    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const premiumUsersRef = collection(db, 'premiumUsers');
    const q = query(premiumUsersRef, where('email', '==', normalizedEmail));
    const querySnapshot = await getDocs(q);

    let premiumDocId;

    if (!querySnapshot.empty) {
      premiumDocId = querySnapshot.docs[0].id;
      await updateDoc(doc(premiumUsersRef, premiumDocId), {
        active: true,
        updatedAt: new Date().toISOString(),
        stripeSubscriptionActive: true,
        userId: userId
      });
    } else {
      const premiumUserData = {
        email: normalizedEmail,
        userId: userId,
        active: true,
        stripeSubscriptionActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = doc(premiumUsersRef);
      await setDoc(docRef, premiumUserData);
      premiumDocId = docRef.id;
    }

    await updateDoc(userRef, {
      isPremium: true,
      premiumSince: new Date().toISOString(),
      email: normalizedEmail,
      premiumDocId,
      stripeSubscriptionActive: true,
      updatedAt: new Date().toISOString(),
      lastVerified: new Date().toISOString()
    });

    const verificationResult = await verifyPremiumStatus(userId);
    if (!verificationResult.isPremium) {
      throw new Error('Premium status verification failed after update');
    }

    return true;
  } catch (error) {
    console.error('Error in addPremiumUser:', error);
    throw error;
  }
};

export const verifyPremiumStatus = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userData = await getDoc(userRef);
    
    if (!userData.exists()) {
      throw new Error('User not found');
    }
    
    const user = userData.data();
    
    const premiumUsersRef = collection(db, 'premiumUsers');
    const q = query(
      premiumUsersRef,
      where('email', '==', user.email.toLowerCase()),
      where('active', '==', true),
      where('stripeSubscriptionActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const isPremium = !querySnapshot.empty;
    
    await updateDoc(userRef, {
      isPremium,
      lastVerified: new Date().toISOString(),
      stripeSubscriptionActive: isPremium,
      updatedAt: new Date().toISOString()
    });
    
    return {
      isPremium,
      lastVerified: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error verifying premium status:', error);
    return {
      isPremium: false,
      lastVerified: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const createUser = async (email: string, password: string, username: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: username });
    
    const isPremium = await verifyPremiumStatus(userCredential.user.uid);
    
    const userData: UserData = {
      username,
      email: email.toLowerCase(),
      isPremium: isPremium.isPremium,
      savedRecipes: [],
      mealPlans: [],
      preferences: {
        dietaryRestrictions: [],
        servingSize: 2,
        theme: 'light',
        caloriePreferences: {
          dailyTotal: 2000,
          breakfast: 500,
          lunch: 600,
          dinner: 700,
          snacks: 200
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', userCredential.user.uid), userData);
    return userCredential.user;
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    const verificationResult = await verifyPremiumStatus(userCredential.user.uid);
    
    await updateDoc(doc(db, 'users', userCredential.user.uid), {
      isPremium: verificationResult.isPremium,
      lastVerified: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
};

export const updateUserData = async (userId: string, data: Partial<UserData>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user data:', error);
    throw new Error('Failed to update user data. Please try again.');
  }
};

export const updateCaloriePreferences = async (userId: string, preferences: CaloriePreferences) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'preferences.caloriePreferences': preferences,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating calorie preferences:', error);
    throw error;
  }
};

const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'An error occurred. Please try again.';
  }
};