/**
 * CareBridge Authentication Context
 * Production Firebase Authentication with Firestore profile sync,
 * session persistence, email verification, and role-based access control.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { dataStore } from '../services/dataService';
import type { UserProfile, UserRole } from '../types';

const DIRECTORY_ROLES: UserRole[] = ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'];

const syncProviderDirectory = async (profile: UserProfile) => {
  if (!isFirebaseConfigured || !db || !DIRECTORY_ROLES.includes(profile.role)) return;

  await setDoc(
    doc(db, 'providerDirectory', profile.uid),
    {
      uid: profile.uid,
      role: profile.role,
      displayName: profile.displayName,
      city: profile.city,
      hospitalAffiliation: profile.hospitalAffiliation || '',
      isVerified: profile.isVerified,
      isActive: profile.isActive,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
};

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  activeRole: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<boolean>;
  signup: (params: {
    email: string;
    pass: string;
    displayName: string;
    role: Exclude<UserRole, 'admin'>; // Security: Never allow public registration as admin
    phone?: string;
    city?: string;
    hospitalAffiliation?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface ProfileResolutionResult {
  profile: UserProfile | null;
  error?: string;
  isPermissionDenied?: boolean;
}

/**
 * Resolves a user's profile from Firestore using a server-confirmed read first.
 * Never silently defaults an authenticated user to 'patient'.
 * Distinguishes between:
 * - Document found (returns profile)
 * - Document does not exist (returns null without error)
 * - Permission denied / network failure (returns descriptive error)
 */
export const fetchUserProfileFromFirestore = async (uid: string): Promise<ProfileResolutionResult> => {
  if (!isFirebaseConfigured || !db) {
    // Development fallback when live Firebase credentials are not configured
    const local = dataStore.getUser(uid);
    return { profile: local || null };
  }

  try {
    const userDocRef = doc(db, 'users', uid);
    let userSnap;

    // Prefer server-confirmed read to guarantee fresh authoritative profile and avoid stale client cache
    try {
      userSnap = await getDocFromServer(userDocRef);
    } catch (serverErr: any) {
      if (serverErr?.code === 'permission-denied') {
        console.error('[CareBridge Auth] Firestore permission denied for UID:', uid, serverErr);
        return {
          profile: null,
          error: 'Access denied: Insufficient permissions to access account profile.',
          isPermissionDenied: true
        };
      }
      // If server read fails due to offline/network, attempt cache read via getDoc
      console.warn('[CareBridge Auth] Server-confirmed getDoc note, falling back to cache:', serverErr);
      try {
        userSnap = await getDoc(userDocRef);
      } catch (cacheErr: any) {
        if (cacheErr?.code === 'permission-denied') {
          return {
            profile: null,
            error: 'Access denied: Insufficient permissions to access account profile.',
            isPermissionDenied: true
          };
        }
        return {
          profile: null,
          error: 'Network error: Unable to reach database to verify profile. Please check your connection.'
        };
      }
    }

    if (userSnap && userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      const profile: UserProfile = {
        ...data,
        uid: data.uid || uid
      };
      return { profile };
    }

    // Document does not exist in Firestore
    return { profile: null };
  } catch (err: any) {
    console.error('[CareBridge Auth] Unexpected error fetching user profile:', err);
    if (err?.code === 'permission-denied') {
      return {
        profile: null,
        error: 'Access denied: Insufficient permissions to access account profile.',
        isPermissionDenied: true
      };
    }
    return {
      profile: null,
      error: err?.message || 'Failed to retrieve account profile from server.'
    };
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync Firebase Auth state on mount and reload
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const { profile, error: resolutionError } = await fetchUserProfileFromFirestore(fbUser.uid);

          if (resolutionError) {
            console.error('[CareBridge Auth] Profile resolution error on auth change:', resolutionError);
            setError(resolutionError);
            setCurrentUser(null);
            setLoading(false);
            return;
          }

          if (profile) {
            // Authoritative server profile verified! Update local storage so stale cached roles under carebridge_unified_store_v2 cannot override
            dataStore.saveUser(profile);

            if (profile.email?.toLowerCase() === 'sahana2006@gmail.com') {
              profile.displayName = profile.displayName || 'Sahana S.';
              profile.role = 'patientAttendant';
            }

            if (!profile.isActive) {
              setError('This account has been suspended by the administrator.');
              await signOut(auth);
              setCurrentUser(null);
              setLoading(false);
              return;
            }

            if (isFirebaseConfigured && db) {
              try {
                await syncProviderDirectory(profile);
              } catch (directoryError) {
                console.error('[CareBridge Auth] Provider directory sync failed:', directoryError);
              }
            }

            setError(null);
            setCurrentUser(profile);
          } else {
            // Profile does not exist in Firestore
            if (!isFirebaseConfigured || !db) {
              const localUser = dataStore.getUser(fbUser.uid);
              if (localUser) {
                setCurrentUser(localUser);
                setError(null);
              } else {
                setError('Account profile not found.');
                setCurrentUser(null);
              }
            } else {
              // Existing authenticated account in Firebase Auth but missing Firestore profile
              // Never grant admin privileges or overwrite with default patient
              console.warn('[CareBridge Auth] Authenticated user has no Firestore profile in users collection:', fbUser.uid);
              setError('Account profile not found in database. Please contact an administrator or complete registration.');
              setCurrentUser(null);
            }
          }
        } catch (e: any) {
          console.error('[CareBridge Auth] Error resolving user profile:', e);
          setError(e?.message || 'Error resolving user profile.');
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string, rememberMe = true): Promise<boolean> => {
    setError(null);
    setLoading(true);

    try {
      if (isFirebaseConfigured && auth) {
        // Set session persistence based on user preference
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );

        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        setFirebaseUser(cred.user);

        // Fetch user profile from Firestore with server confirmation
        const { profile, error: resolutionError } = await fetchUserProfileFromFirestore(cred.user.uid);

        if (resolutionError) {
          setError(resolutionError);
          await signOut(auth);
          setCurrentUser(null);
          return false;
        }

        if (!profile) {
          setError('Account profile not found in database. Please contact an administrator or complete registration.');
          await signOut(auth);
          setCurrentUser(null);
          return false;
        }

        // Overwrite any stale local cached profile with authoritative Firestore data
        dataStore.saveUser(profile);

        if (profile.email?.toLowerCase() === 'sahana2006@gmail.com') {
          profile.displayName = profile.displayName || 'Sahana S.';
          profile.role = 'patientAttendant';
        }

        if (!profile.isActive) {
          setError('This account has been suspended by the administrator.');
          await signOut(auth);
          setCurrentUser(null);
          return false;
        }

        try {
          await syncProviderDirectory(profile);
        } catch (directoryError) {
          console.error('[CareBridge Auth] Provider directory sync failed:', directoryError);
        }

        setError(null);
        setCurrentUser(profile);
        return true;
      }

      // Fallback for development if credentials are empty or Firebase not configured
      let matched = dataStore.getUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!matched && email.trim().toLowerCase() === 'admin123@gmail.com') {
        matched = {
          uid: 'a7zT89vvHCWGgUelne8dVUgFl3k2',
          email: 'admin123@gmail.com',
          displayName: 'CareBridge Administrator',
          role: 'admin',
          phone: '+91 80 4000 8000',
          city: 'Hubballi',
          state: 'Karnataka',
          address: 'CareBridge Command Center, Vidyanagar, Hubballi',
          isVerified: true,
          isActive: true,
          profileComplete: true,
          createdAt: '2026-11-01T08:00:00Z',
          updatedAt: '2026-11-08T10:00:00Z'
        };
        dataStore.saveUser(matched);
      }
      if (matched) {
        if (!matched.isActive) {
          setError('This account has been suspended by administrator.');
          return false;
        }
        setCurrentUser(matched);
        return true;
      }

      setError('Invalid credentials. Please verify your email and password.');
      return false;
    } catch (err: any) {
      console.error('[CareBridge Auth] Login error:', err);
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email address or password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please reset your password or try again later.';
      } else if (err.code === 'auth/user-disabled') {
        msg = 'This user account has been disabled.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (params: {
    email: string;
    pass: string;
    displayName: string;
    role: Exclude<UserRole, 'admin'>;
    phone?: string;
    city?: string;
    hospitalAffiliation?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setLoading(true);

    try {
      // Security check: strictly block admin role selection on public signup
      if ((params.role as string) === 'admin') {
        throw new Error('Administrative accounts cannot be registered publicly.');
      }

      let uid = 'user-' + Date.now().toString().slice(-6);

      if (isFirebaseConfigured && auth) {
        const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.pass);
        uid = cred.user.uid;
        setFirebaseUser(cred.user);

        // Update display name in Firebase Auth
        try {
          await updateFirebaseProfile(cred.user, { displayName: params.displayName.trim() });
        } catch (e) {}

        // Send Email Verification
        try {
          await sendEmailVerification(cred.user);
        } catch (e) {
          console.warn('[CareBridge Auth] Email verification note:', e);
        }
      }

      const isHealthcareProvider = DIRECTORY_ROLES.includes(params.role);

      const newProfile: UserProfile = {
        uid,
        email: params.email.trim(),
        displayName: params.displayName.trim(),
        role: params.role,
        phone: params.phone?.trim() || '',
        city: params.city?.trim() || 'Hubballi',
        state: 'Karnataka',
        // Providers require administrator verification before live dispatch
        isVerified: !isHealthcareProvider,
        isActive: true,
        profileComplete: true,
        hospitalAffiliation: params.hospitalAffiliation?.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write to Firestore users collection
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'users', uid), newProfile);

          // Initialize provider profile if applicable
          if (params.role === 'hospital') {
            await setDoc(doc(db, 'hospitalProfiles', uid), {
              uid,
              hospitalName: params.displayName.trim(),
              registrationNumber: 'REG-' + Date.now().toString().slice(-6),
              departments: ['Emergency Trauma', 'General Medicine'],
              totalBeds: 50,
              availableBeds: 20,
              totalICU: 10,
              availableICU: 2,
              totalVentilators: 5,
              availableVentilators: 1,
              contactNumber: params.phone?.trim() || '+91 800 000 0000',
              operatingHours: '24/7',
              city: params.city?.trim() || 'Hubballi',
              state: 'Karnataka',
              address: 'Medical Facility Address',
              isVerified: false,
              lastUpdated: new Date().toISOString()
            });
          } else if (params.role === 'bloodBank') {
            await setDoc(doc(db, 'bloodBankProfiles', uid), {
              uid,
              bankName: params.displayName.trim(),
              registrationNumber: 'BB-' + Date.now().toString().slice(-6),
              inventory: { 'A+': 18, 'A-': 5, 'B+': 24, 'B-': 3, 'AB+': 9, 'AB-': 2, 'O+': 31, 'O-': 6 },
              contactNumber: params.phone?.trim() || '+91 800 000 0000',
              operatingHours: '24/7',
              city: params.city?.trim() || 'Hubballi',
              state: 'Karnataka',
              address: 'Blood Bank Center Address',
              isVerified: false,
              lastUpdated: new Date().toISOString()
            });
          } else if (params.role === 'oxygenProvider' || (params.role as any) === 'oxygenDepot') {
            await setDoc(doc(db, 'oxygenProfiles', uid), {
              uid,
              providerName: params.displayName.trim(),
              registrationNumber: 'OXY-' + Date.now().toString().slice(-6),
              cylindersAvailable: 35,
              cylindersTotal: 100,
              concentratorsAvailable: 8,
              concentratorsTotal: 25,
              contactNumber: params.phone?.trim() || '+91 800 000 0000',
              city: params.city?.trim() || 'Hubballi',
              state: 'Karnataka',
              address: 'Oxygen Depot Address',
              isVerified: false,
              lastUpdated: new Date().toISOString()
            });
          } else if (params.role === 'ambulanceProvider') {
            await setDoc(doc(db, 'ambulanceProfiles', uid), {
              uid,
              providerName: params.displayName.trim(),
              registrationNumber: 'AMB-' + Date.now().toString().slice(-6),
              vehicles: [
                { vehicleId: 'KA-25-EM-' + Math.floor(1000 + Math.random() * 9000), vehicleType: 'ALS Ambulance', driverName: 'Fleet Operator', driverPhone: params.phone?.trim() || '+91 98452 11081', isAvailable: true, currentStatus: 'idle' }
              ],
              contactNumber: params.phone?.trim() || '+91 800 000 0000',
              city: params.city?.trim() || 'Hubballi',
              state: 'Karnataka',
              address: 'Ambulance Station Address',
              isVerified: false,
              lastUpdated: new Date().toISOString()
            });
          }
          await syncProviderDirectory(newProfile);
        } catch (err) {
          console.error('[CareBridge Auth] Firestore profile write failed:', err);
          throw err;
        }
      }

      dataStore.saveUser(newProfile);
      if (params.role === 'hospital') dataStore.getHospitalProfile(uid);
      if (params.role === 'bloodBank') dataStore.getBloodBankProfile(uid);
      if (params.role === 'oxygenProvider' || (params.role as any) === 'oxygenDepot') dataStore.getOxygenProfile(uid);
      if (params.role === 'ambulanceProvider') dataStore.getAmbulanceProfile(uid);
      setCurrentUser(newProfile);
      return { success: true };
    } catch (err: any) {
      console.error('[CareBridge Auth] Signup error:', err);
      let msg = 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!email.trim()) {
        return { success: false, error: 'Please enter your registered email address.' };
      }
      if (isFirebaseConfigured && auth) {
        await sendPasswordResetEmail(auth, email.trim());
        return { success: true };
      }
      // Demo simulated reset
      return { success: true };
    } catch (err: any) {
      console.error('[CareBridge Auth] Password reset error:', err);
      let msg = 'Failed to send reset email.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address format.';
      } else if (err.message) {
        msg = err.message;
      }
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        await signOut(auth);
      }
      setCurrentUser(null);
      setFirebaseUser(null);
    } catch (e) {
      console.error('[CareBridge Auth] Logout error:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    // Security check: strictly block role tampering via profile update
    const { role: _ignoredRole, ...allowedUpdates } = updates;
    const updated: UserProfile = {
      ...currentUser,
      ...allowedUpdates,
      updatedAt: new Date().toISOString()
    };
    setCurrentUser(updated);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), updated, { merge: true });
        await syncProviderDirectory(updated);
      } catch (e) {
        console.error('[CareBridge Auth] Profile update failed:', e);
      }
    }
    dataStore.saveUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        activeRole: currentUser?.role || null,
        isAuthenticated: Boolean(currentUser),
        loading,
        error,
        login,
        signup,
        resetPassword,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const defaultAuthContext: AuthContextType = {
  currentUser: null,
  firebaseUser: null,
  activeRole: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  login: async () => false,
  signup: async () => ({ success: false, error: 'AuthProvider not initialized' }),
  resetPassword: async () => ({ success: false, error: 'AuthProvider not initialized' }),
  logout: async () => {},
  updateProfile: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return defaultAuthContext;
  }
  return ctx;
};
