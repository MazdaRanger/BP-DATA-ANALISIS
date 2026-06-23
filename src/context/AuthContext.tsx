import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebaseConfig";

export interface UserRole {
  role: "super_admin" | "user" | null;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          if (currentUser.uid === 'KP0e80jaapPjDC02InH6Yv7hGwC2') {
            setRole("super_admin");
            // ensure the document sets it for consistency
            await setDoc(doc(db, "users", currentUser.uid), {
                email: currentUser.email,
                role: "super_admin",
                updatedAt: new Date().toISOString()
            }, { merge: true }).catch(console.warn);
          } else {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
              setRole(userDoc.data().role || "user");
            } else {
              setRole("user"); // default role
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole("user");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
