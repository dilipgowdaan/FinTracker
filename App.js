import React, { useState, useEffect, useContext, createContext, useMemo, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Modal, KeyboardAvoidingView, Platform, 
  Dimensions, StatusBar, ActivityIndicator, Animated 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- FIREBASE IMPORTS ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, getReactNativePersistence, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, getAuth, updateProfile
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "fintracker-2292c.firebaseapp.com",
  projectId: "fintracker-2292c",
  storageBucket: "fintracker-2292c.firebasestorage.app",
  messagingSenderId: "251779023340",
  appId: "1:251779023340:web:35b39dc9f007df3b1580c9",
  measurementId: "G-RYGZ1RHFWH"
};

let app, auth, db;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } else {
    app = getApp();
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); 
  }
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase Init Warning (Check your config):", error.message);
}

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// ==========================================
// 2. CONSTANTS & CONFIGURATION
// ==========================================
const THEMES = {
  light: {
    isDark: false, background: '#F3F4F6', card: '#FFFFFF', text: '#111827',
    textSecondary: '#6B7280', border: '#E5E7EB', expense: '#EF4444', 
    expenseLight: '#FEE2E2', income: '#10B981', incomeLight: '#D1FAE5', overlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    isDark: true, background: '#111827', card: '#1F2937', text: '#F9FAFB',
    textSecondary: '#9CA3AF', border: '#374151', expense: '#F87171', 
    expenseLight: 'rgba(248, 113, 113, 0.2)', income: '#34D399', incomeLight: 'rgba(52, 211, 153, 0.2)', overlay: 'rgba(0,0,0,0.7)',
  }
};

const ACCENTS = {
  purple: { primary: '#6366F1', primaryLight: '#E0E7FF', primaryDark: '#4338CA' },
  blue: { primary: '#3B82F6', primaryLight: '#DBEAFE', primaryDark: '#1D4ED8' },
  green: { primary: '#10B981', primaryLight: '#D1FAE5', primaryDark: '#047857' },
};

const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', family: 'MaterialCommunityIcons', icon: 'food-fork-drink', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', family: 'Ionicons', icon: 'car', color: '#3B82F6' },
  { id: 'shopping', name: 'Shopping', family: 'Ionicons', icon: 'cart', color: '#EC4899' },
  { id: 'bills', name: 'Bills & Utilities', family: 'Ionicons', icon: 'document-text', color: '#8B5CF6' },
  { id: 'entertainment', name: 'Entertainment', family: 'Ionicons', icon: 'film', color: '#14B8A6' },
  { id: 'health', name: 'Health', family: 'Ionicons', icon: 'heart', color: '#EF4444' },
  { id: 'salary', name: 'Salary', family: 'MaterialCommunityIcons', icon: 'cash-multiple', color: '#10B981', isIncome: true },
  { id: 'investment', name: 'Investment', family: 'Ionicons', icon: 'trending-up', color: '#06B6D4' },
  { id: 'other', name: 'Other', family: 'Ionicons', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

const MERCHANT_SUGGESTIONS = ['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Petrol Bunk', 'Uber', 'Ola', 'DMart', 'Starbucks'];

const formatCurrency = (amount) => '₹' + parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

const getRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ==========================================
// 3. CONTEXTS (Theme, Alert, Data)
// ==========================================
const ThemeContext = createContext();
const AlertContext = createContext();
const DataContext = createContext();

const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('light');
  const [accentCode, setAccentCode] = useState('purple');

  const updateTheme = (mode, accent) => { setThemeMode(mode); setAccentCode(accent); };
  const theme = { ...THEMES[themeMode], ...ACCENTS[accentCode], mode: themeMode, accent: accentCode };

  return <ThemeContext.Provider value={{ theme, updateTheme }}>{children}</ThemeContext.Provider>;
};

// CUSTOM ANIMATED ALERT PROVIDER
const AlertProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const [config, setConfig] = useState({ visible: false, title: '', message: '', type: 'error', buttons: [] });
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = (title, message, type = 'error', buttons = [{ text: 'OK' }]) => {
    setConfig({ visible: true, title, message, type, buttons });
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
  };

  const hideAlert = (callback) => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setConfig(prev => ({ ...prev, visible: false }));
      if (callback) setTimeout(callback, 50);
    });
  };

  const getAlertStyles = () => {
    switch (config.type) {
      case 'success': return { icon: 'checkmark-circle', color: theme.income, bg: theme.incomeLight };
      case 'confirm': return { icon: 'help-circle', color: theme.primary, bg: theme.primaryLight };
      case 'error': default: return { icon: 'close-circle', color: theme.expense, bg: theme.expenseLight };
    }
  };

  const alertStyles = getAlertStyles();

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal visible={config.visible} transparent animationType="none">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, backgroundColor: theme.card, borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: alertStyles.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name={alertStyles.icon} size={36} color={alertStyles.color} />
            </View>
            <Typo variant="h2" style={{ textAlign: 'center', marginBottom: 8 }}>{config.title}</Typo>
            <Typo variant="body" color={theme.textSecondary} style={{ textAlign: 'center', marginBottom: 24 }}>{config.message}</Typo>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              {config.buttons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx} onPress={() => hideAlert(btn.onPress)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: btn.style === 'destructive' ? theme.expense : (btn.style === 'cancel' ? theme.background : theme.primary), alignItems: 'center' }}
                >
                  <Typo variant="h3" color={btn.style === 'cancel' ? theme.text : '#FFF'}>{btn.text}</Typo>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

const DataProvider = ({ children, user }) => {
  const { showAlert } = useContext(AlertContext);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [userProfile, setUserProfile] = useState({});

  // Helper to timeout firebase writes so the offline queue doesn't hang indefinitely
  const withTimeout = (promise, ms = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
    ]);
  };

  // 1. Instantly Load Cached Data from Disk
  useEffect(() => {
    const loadCache = async () => {
      if (!user) return;
      try {
        const cachedTxs = await AsyncStorage.getItem(`@txs_${user.uid}`);
        if (cachedTxs) setTransactions(JSON.parse(cachedTxs));
        
        const cachedBudgets = await AsyncStorage.getItem(`@budgets_${user.uid}`);
        if (cachedBudgets) setBudgets(JSON.parse(cachedBudgets));
        
        const cachedProfile = await AsyncStorage.getItem(`@profile_${user.uid}`);
        if (cachedProfile) setUserProfile(JSON.parse(cachedProfile));
      } catch (e) { console.log(e); }
    };
    loadCache();
  }, [user]);

  // 2. Firebase Sync & Update Local Cache (With Offline Protection)
  useEffect(() => {
    if (!user || !db) return;
    
    const txRef = collection(db, 'users', user.uid, 'transactions');
    const unsubTx = onSnapshot(txRef, { includeMetadataChanges: true }, async (snapshot) => {
      // PREVENT CACHE WIPE: Ignore empty reads from memory cache when offline
      if (snapshot.metadata.fromCache) return; 

      let serverTxs = [];
      snapshot.forEach(doc => serverTxs.push({ ...doc.data(), id: doc.id }));

      // Merge server data with pending local queue to prevent UI flickering
      try {
        const queueStr = await AsyncStorage.getItem(`@queue_${user.uid}`);
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          const pendingAdds = queue.filter(q => q.type === 'ADD_TX').map(q => q.payload);
          const pendingDeletes = queue.filter(q => q.type === 'DELETE_TX').map(q => q.payload);
          
          pendingAdds.forEach(ptx => {
            if (!serverTxs.some(t => t.id === ptx.id)) serverTxs.push(ptx);
          });
          serverTxs = serverTxs.filter(t => !pendingDeletes.includes(t.id));
        }
      } catch (e) {}

      serverTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(serverTxs);
      AsyncStorage.setItem(`@txs_${user.uid}`, JSON.stringify(serverTxs)); 
      
      // We got a successful server read, attempt to flush offline actions
      flushOfflineQueue();
    }, (error) => {
      console.log("Firestore sync paused:", error.message);
    });

    const budgetRef = collection(db, 'users', user.uid, 'budgets');
    const unsubBudget = onSnapshot(budgetRef, { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache) return; 
      const bgs = {};
      snapshot.forEach(doc => { bgs[doc.id] = doc.data().limit; });
      setBudgets(bgs);
      AsyncStorage.setItem(`@budgets_${user.uid}`, JSON.stringify(bgs));
    });

    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.metadata.fromCache) return; 
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
        AsyncStorage.setItem(`@profile_${user.uid}`, JSON.stringify(docSnap.data()));
      }
    });

    return () => { unsubTx(); unsubBudget(); unsubUser(); };
  }, [user]);

  // 3. Offline Sync Queue Logic
  const flushOfflineQueue = async () => {
    if (!user || !db) return;
    try {
      const queueStr = await AsyncStorage.getItem(`@queue_${user.uid}`);
      if (!queueStr) return;
      let queue = JSON.parse(queueStr);
      if (queue.length === 0) return;
      
      let remainingQueue = [...queue];
      for (let i = 0; i < queue.length; i++) {
        const action = queue[i];
        try {
          if (action.type === 'ADD_TX') {
            await withTimeout(setDoc(doc(db, 'users', user.uid, 'transactions', action.payload.id), action.payload));
          } else if (action.type === 'DELETE_TX') {
            await withTimeout(deleteDoc(doc(db, 'users', user.uid, 'transactions', action.payload)));
          } else if (action.type === 'SET_BUDGET') {
            const docRef = doc(db, 'users', user.uid, 'budgets', action.payload.categoryId);
            if (action.payload.limit <= 0) await withTimeout(deleteDoc(docRef));
            else await withTimeout(setDoc(docRef, { limit: action.payload.limit }));
          }
          // Remove processed item from queue
          remainingQueue.shift();
          await AsyncStorage.setItem(`@queue_${user.uid}`, JSON.stringify(remainingQueue));
        } catch (err) {
          // Break loop on first failure (we are still offline), preserve remaining queue
          break; 
        }
      }
    } catch (e) {
      console.log("Queue flush error:", e);
    }
  };

  const addToOfflineQueue = async (action) => {
    try {
      const queueStr = await AsyncStorage.getItem(`@queue_${user.uid}`);
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(action);
      await AsyncStorage.setItem(`@queue_${user.uid}`, JSON.stringify(queue));
    } catch (e) { console.log(e); }
  };

  // Actions
  const addTransaction = async (tx) => {
    if (!user || !db) return;
    const newId = generateId();
    const newTx = { ...tx, id: newId, date: new Date().toISOString() };
    
    // Optimistic Local UI Update
    const newTxs = [newTx, ...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(newTxs);
    await AsyncStorage.setItem(`@txs_${user.uid}`, JSON.stringify(newTxs));

    await addToOfflineQueue({ type: 'ADD_TX', payload: newTx });
    flushOfflineQueue();
  };

  const deleteTransaction = async (id) => {
    if (!user || !db) return;
    
    // Optimistic Local UI Update
    const newTxs = transactions.filter(t => t.id !== id);
    setTransactions(newTxs);
    await AsyncStorage.setItem(`@txs_${user.uid}`, JSON.stringify(newTxs));

    await addToOfflineQueue({ type: 'DELETE_TX', payload: id });
    flushOfflineQueue();
  };

  const setCategoryBudget = async (categoryId, limit) => {
    if (!user || !db) return;
    
    const newBudgets = { ...budgets, [categoryId]: limit };
    if (limit <= 0) delete newBudgets[categoryId];
    setBudgets(newBudgets);
    await AsyncStorage.setItem(`@budgets_${user.uid}`, JSON.stringify(newBudgets));

    await addToOfflineQueue({ type: 'SET_BUDGET', payload: { categoryId, limit } });
    flushOfflineQueue();
  };

  const updateUserProfile = async (name, phone) => {
    if (!user || !db) return;
    try {
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), { name, phone }, { merge: true });
    } catch (err) {
      showAlert("Update Error", "Could not update profile.", "error");
    }
  };

  const stats = useMemo(() => {
    let totalIncome = 0; let totalExpense = 0;
    let upiBalance = 0; let cashBalance = 0;
    let upiSpend = 0; let cashSpend = 0;
    
    const categoryTotals = {};
    const merchantTotals = {};
    
    transactions.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'income') {
        totalIncome += amt;
        if (t.wallet === 'upi') upiBalance += amt; else cashBalance += amt;
      } else {
        totalExpense += amt;
        if (t.wallet === 'upi') { upiBalance -= amt; upiSpend += amt; } 
        else { cashBalance -= amt; cashSpend += amt; }
        
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
        if (t.merchant) merchantTotals[t.merchant] = (merchantTotals[t.merchant] || 0) + amt;
      }
    });

    const topMerchant = Object.keys(merchantTotals).sort((a, b) => merchantTotals[b] - merchantTotals[a])[0];
    const topCategory = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0];
    const topCategoryName = CATEGORIES.find(c => c.id === topCategory)?.name;
    
    const upiPercentage = totalExpense > 0 ? Math.round((upiSpend / totalExpense) * 100) : 0;

    return { 
      totalBalance: totalIncome - totalExpense, totalIncome, totalExpense, 
      upiBalance, cashBalance, upiSpend, cashSpend, upiPercentage,
      categoryTotals, merchantTotals, topMerchant, topCategoryName
    };
  }, [transactions]);

  return (
    <DataContext.Provider value={{ transactions, addTransaction, deleteTransaction, stats, budgets, setCategoryBudget, userProfile, updateUserProfile }}>
      {children}
    </DataContext.Provider>
  );
};

// ==========================================
// 4. UI COMPONENTS
// ==========================================
const RenderIcon = ({ family, name, size, color }) => {
  if (family === 'Ionicons') return <Ionicons name={name} size={size} color={color} />;
  if (family === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name} size={size} color={color} />;
  return <Ionicons name="help" size={size} color={color} />;
};

const Typo = ({ variant = 'body', color, style, children, weight, numberOfLines }) => {
  const { theme } = useContext(ThemeContext);
  let base = { color: color || theme.text, fontWeight: weight || 'normal' };
  
  if (variant === 'h1') { base.fontSize = 28; base.fontWeight = weight || 'bold'; }
  else if (variant === 'h2') { base.fontSize = 22; base.fontWeight = weight || 'bold'; }
  else if (variant === 'h3') { base.fontSize = 18; base.fontWeight = weight || '600'; }
  else if (variant === 'body') { base.fontSize = 15; }
  else if (variant === 'caption') { base.fontSize = 13; base.color = color || theme.textSecondary; }

  return <Text style={[base, style]} numberOfLines={numberOfLines}>{children}</Text>;
};

const Card = ({ children, style, padding = 16, noPadding = false }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={[{
        backgroundColor: theme.card, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0,
        padding: noPadding ? 0 : padding, borderRadius: 20, marginBottom: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: theme.isDark ? 0 : 0.05, shadowRadius: 12, elevation: theme.isDark ? 0 : 2,
      }, style]}>
      {children}
    </View>
  );
};

const SafeContainer = ({ children, style, center = false }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={[{ 
      flex: 1, backgroundColor: theme.background, 
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
      justifyContent: center ? 'center' : 'flex-start'
    }, style]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      {children}
    </View>
  );
};

const DropdownModal = ({ visible, onClose, options, selectedValue, onSelect, title }) => {
  const { theme } = useContext(ThemeContext);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 32 }]} activeOpacity={1} onPress={onClose}>
        <View style={{ backgroundColor: theme.card, borderRadius: 20, overflow: 'hidden', maxHeight: Dimensions.get('window').height * 0.7 }}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Typo variant="h3">{title}</Typo>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((opt, idx) => {
              const isSelected = selectedValue === opt.value;
              return (
                <TouchableOpacity 
                  key={opt.value} 
                  onPress={() => { onSelect(opt.value); onClose(); }} 
                  style={{ paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: idx === options.length - 1 ? 0 : 1, borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Typo variant="body" weight={isSelected ? 'bold' : 'normal'} color={isSelected ? theme.primary : theme.text}>{opt.label}</Typo>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const TransactionItem = ({ item }) => {
  const { theme } = useContext(ThemeContext);
  const { showAlert } = useContext(AlertContext);
  const { deleteTransaction } = useContext(DataContext);
  const category = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
  const isIncome = item.type === 'income';

  const confirmDelete = () => {
    showAlert(
      "Delete Transaction", 
      `Remove transaction for ${item.merchant || category.name}?`, 
      "confirm", 
      [
        { text: "Cancel", style: "cancel" }, 
        { text: "Delete", style: "destructive", onPress: () => deleteTransaction(item.id) }
      ]
    );
  };

  return (
    <TouchableOpacity onLongPress={confirmDelete} style={[styles.txItem, { borderBottomColor: theme.border }]}>
      <View style={[styles.txIconBg, { backgroundColor: isIncome ? theme.incomeLight : theme.primaryLight }]}>
        <RenderIcon family={category.family} name={category.icon} size={22} color={isIncome ? theme.income : theme.primary} />
      </View>
      <View style={styles.txDetails}>
        <Typo variant="body" weight="600" numberOfLines={1}>{item.merchant || category.name}</Typo>
        <View style={styles.txSubDetails}>
          <View style={[styles.walletBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Typo variant="caption" style={{ fontSize: 9, fontWeight: 'bold' }}>{item.wallet.toUpperCase()}</Typo>
          </View>
          <Typo variant="caption" style={{ fontSize: 12 }}>{getRelativeDate(item.date)}</Typo>
        </View>
      </View>
      <View style={styles.txAmount}>
        <Typo variant="h3" color={isIncome ? theme.income : theme.text}>
          {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
        </Typo>
        {item.notes ? <Typo variant="caption" numberOfLines={1} style={{ maxWidth: 80, marginTop: 2 }}>{item.notes}</Typo> : null}
      </View>
    </TouchableOpacity>
  );
};

// ==========================================
// 5. AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
  const { theme } = useContext(ThemeContext);
  const { showAlert } = useContext(AlertContext);
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      return showAlert("Missing Details", "Please fill in all email and password fields.", "error");
    }
    if (!isLogin && (!name.trim() || !phone.trim())) {
      return showAlert("Missing Details", "Please provide your Name and Mobile Number to create an account.", "error");
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          createdAt: new Date().toISOString()
        });
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (error.code === 'auth/email-already-in-use') msg = "An account with this email already exists.";
      if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      showAlert("Authentication Failed", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeContainer center>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 40, flexGrow: 1, justifyContent: 'center' }}>
          
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <View style={[styles.avatarLarge, { backgroundColor: theme.primaryLight, marginBottom: 16 }]}>
              <Ionicons name="wallet" size={32} color={theme.primary} />
            </View>
            <Typo variant="h1" style={{ textAlign: 'center' }}>FinTracker</Typo>
            <Typo variant="body" color={theme.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
              Manage your finances securely online.
            </Typo>
          </View>

          <Card padding={24}>
            <Typo variant="h2" style={{ marginBottom: 20 }}>{isLogin ? 'Welcome Back' : 'Create Account'}</Typo>
            
            {!isLogin && (
              <>
                <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Full Name</Typo>
                <TextInput 
                  style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 16 }]}
                  placeholder="John Doe" placeholderTextColor={theme.textSecondary}
                  value={name} onChangeText={setName}
                />
                
                <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Mobile Number</Typo>
                <TextInput 
                  style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 16 }]}
                  placeholder="+91 9876543210" placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad" value={phone} onChangeText={setPhone}
                />
              </>
            )}
            
            <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Email Address</Typo>
            <TextInput 
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 16 }]}
              placeholder="you@example.com" placeholderTextColor={theme.textSecondary}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            />

            <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Password</Typo>
            <TextInput 
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 30 }]}
              placeholder="••••••••" placeholderTextColor={theme.textSecondary}
              value={password} onChangeText={setPassword} secureTextEntry
            />

            <TouchableOpacity 
              onPress={handleAuth} disabled={loading}
              style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Typo variant="h3" color="#FFF" weight="bold">{isLogin ? 'Log In' : 'Sign Up'}</Typo>}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
              <Typo variant="body">{isLogin ? "Don't have an account? " : "Already have an account? "}</Typo>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Typo variant="body" color={theme.primary} weight="bold">{isLogin ? 'Sign Up' : 'Log In'}</Typo>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeContainer>
  );
};

// ==========================================
// 6. MAIN SCREENS
// ==========================================

// --- HOME SCREEN ---
const HomeScreen = ({ user }) => {
  const { theme } = useContext(ThemeContext);
  const { transactions, stats, userProfile } = useContext(DataContext);

  const insight = transactions.length === 0 ? "Add your first transaction!" 
    : stats.topMerchant ? `You spent the most at ${stats.topMerchant} recently.` 
    : `Most spending is on ${stats.topCategoryName || 'various items'}.`;
    
  const displayName = userProfile?.name || user?.displayName || user?.email || 'User';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <View style={styles.header}>
        <View>
          <Typo variant="caption" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>Total Balance</Typo>
          <Typo variant="h1" style={{ fontSize: 38, marginTop: 4 }}>{formatCurrency(stats.totalBalance)}</Typo>
        </View>
        <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
          <Typo variant="h3" color={theme.primary}>{displayName.charAt(0).toUpperCase()}</Typo>
        </View>
      </View>

      <View style={styles.row}>
        <Card style={[styles.flex1, styles.rowCenter, { marginRight: 8 }]} padding={14}>
          <View style={[styles.smallIconBg, { backgroundColor: theme.incomeLight }]}><Ionicons name="arrow-down" size={18} color={theme.income} /></View>
          <View style={styles.flex1}>
            <Typo variant="caption">Income</Typo>
            <Typo variant="h3" color={theme.income} numberOfLines={1}>{formatCurrency(stats.totalIncome)}</Typo>
          </View>
        </Card>
        <Card style={[styles.flex1, styles.rowCenter, { marginLeft: 8 }]} padding={14}>
          <View style={[styles.smallIconBg, { backgroundColor: theme.expenseLight }]}><Ionicons name="arrow-up" size={18} color={theme.expense} /></View>
          <View style={styles.flex1}>
            <Typo variant="caption">Expense</Typo>
            <Typo variant="h3" color={theme.expense} numberOfLines={1}>{formatCurrency(stats.totalExpense)}</Typo>
          </View>
        </Card>
      </View>

      <Typo variant="h3" style={{ marginVertical: 16 }}>Your Wallets</Typo>
      <View style={styles.row}>
        <View style={[styles.walletCard, { backgroundColor: theme.primary, marginRight: 8 }]}>
          <MaterialCommunityIcons name="qrcode-scan" size={80} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', bottom: -10, right: -10 }} />
          <Ionicons name="qr-code" size={24} color="white" style={{ marginBottom: 12 }} />
          <Typo variant="caption" color="rgba(255,255,255,0.8)">UPI Balance</Typo>
          <Typo variant="h2" color="white" style={{ marginTop: 4 }}>{formatCurrency(stats.upiBalance)}</Typo>
        </View>
        <View style={[styles.walletCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, marginLeft: 8 }]}>
          <Ionicons name="wallet" size={80} color={theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"} style={{ position: 'absolute', bottom: -10, right: -10 }} />
          <Ionicons name="wallet" size={24} color={theme.textSecondary} style={{ marginBottom: 12 }} />
          <Typo variant="caption">Cash Balance</Typo>
          <Typo variant="h2" style={{ marginTop: 4 }}>{formatCurrency(stats.cashBalance)}</Typo>
        </View>
      </View>

      <Card style={[{ backgroundColor: theme.primaryLight, borderWidth: 0, marginTop: 16, flexDirection: 'row', alignItems: 'center' }]}>
        <Ionicons name="bulb" size={28} color={theme.primaryDark} style={{ marginRight: 16 }} />
        <View style={styles.flex1}>
          <Typo variant="body" color={theme.primaryDark} weight="bold">Quick Insight</Typo>
          <Typo variant="caption" color={theme.primaryDark} style={{ marginTop: 2 }}>{insight}</Typo>
        </View>
      </Card>

      <Typo variant="h3" style={{ marginTop: 16, marginBottom: 12 }}>Recent Transactions</Typo>
      <Card noPadding style={{ overflow: 'hidden' }}>
        {transactions.slice(0, 5).length > 0 ? (
          transactions.slice(0, 5).map((item) => <View key={item.id} style={{ paddingHorizontal: 16 }}><TransactionItem item={item} /></View>)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={theme.border} />
            <Typo variant="caption" style={{ marginTop: 12 }}>No transactions yet.</Typo>
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

// --- TRANSACTIONS (HISTORY & SEARCH) SCREEN ---
const TransactionsScreen = () => {
  const { theme } = useContext(ThemeContext);
  const { transactions } = useContext(DataContext);
  const [search, setSearch] = useState('');
  
  const [filterType, setFilterType] = useState('all'); 
  const [filterWallet, setFilterWallet] = useState('all'); 
  const [filterCategory, setFilterCategory] = useState('all'); 
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const typeOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' }
  ];

  const walletOptions = [
    { label: 'All Wallets', value: 'all' },
    { label: 'UPI', value: 'upi' },
    { label: 'Cash', value: 'cash' }
  ];

  const categoryOptions = [
    { label: 'All Categories', value: 'all' },
    ...CATEGORIES.map(c => ({ label: c.name, value: c.id }))
  ];

  const filteredData = transactions.filter(t => {
    const matchesSearch = (t.merchant || '').toLowerCase().includes(search.toLowerCase()) || (t.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesWallet = filterWallet === 'all' || t.wallet === filterWallet;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesType && matchesWallet && matchesCategory;
  });

  const grouped = filteredData.reduce((acc, tx) => {
    const dateStr = getRelativeDate(tx.date);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(tx);
    return acc;
  }, {});

  const selectedTypeLabel = typeOptions.find(o => o.value === filterType)?.label;
  const selectedWalletLabel = walletOptions.find(o => o.value === filterWallet)?.label;
  const selectedCategoryLabel = categoryOptions.find(o => o.value === filterCategory)?.label || 'All Categories';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 20, paddingBottom: 10 }}>
        <Typo variant="h2" style={{ marginBottom: 16 }}>History</Typo>
        
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput 
            style={{ flex: 1, color: theme.text, fontSize: 15 }} 
            placeholder="Search merchants or notes..." 
            placeholderTextColor={theme.textSecondary}
            value={search} onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color={theme.textSecondary} /></TouchableOpacity> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingRight: 20 }}>
          <TouchableOpacity 
            onPress={() => setShowTypePicker(true)} 
            style={[styles.dropdownTrigger, { backgroundColor: theme.card, borderColor: theme.border, marginRight: 12 }]}
          >
            <Typo variant="caption" weight="bold" color={filterType !== 'all' ? theme.primary : theme.text}>{selectedTypeLabel}</Typo>
            <Ionicons name="chevron-down" size={16} color={filterType !== 'all' ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setShowWalletPicker(true)} 
            style={[styles.dropdownTrigger, { backgroundColor: theme.card, borderColor: theme.border, marginRight: 12 }]}
          >
            <Typo variant="caption" weight="bold" color={filterWallet !== 'all' ? theme.primary : theme.text}>{selectedWalletLabel}</Typo>
            <Ionicons name="chevron-down" size={16} color={filterWallet !== 'all' ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowCategoryPicker(true)} 
            style={[styles.dropdownTrigger, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Typo variant="caption" weight="bold" color={filterCategory !== 'all' ? theme.primary : theme.text}>{selectedCategoryLabel}</Typo>
            <Ionicons name="chevron-down" size={16} color={filterCategory !== 'all' ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {Object.keys(grouped).length > 0 ? Object.keys(grouped).map(dateGroup => (
          <View key={dateGroup} style={{ marginBottom: 20 }}>
            <Typo variant="caption" style={{ marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>{dateGroup}</Typo>
            <Card noPadding>
              {grouped[dateGroup].map(item => <View key={item.id} style={{ paddingHorizontal: 16 }}><TransactionItem item={item} /></View>)}
            </Card>
          </View>
        )) : (
          <View style={[styles.emptyState, { marginTop: 40 }]}>
            <Ionicons name="search-outline" size={64} color={theme.border} />
            <Typo variant="body" style={{ marginTop: 16 }}>No matching transactions.</Typo>
          </View>
        )}
      </ScrollView>

      <DropdownModal 
        title="Filter by Type" visible={showTypePicker} 
        onClose={() => setShowTypePicker(false)} 
        options={typeOptions} selectedValue={filterType} onSelect={setFilterType} 
      />
      <DropdownModal 
        title="Filter by Wallet" visible={showWalletPicker} 
        onClose={() => setShowWalletPicker(false)} 
        options={walletOptions} selectedValue={filterWallet} onSelect={setFilterWallet} 
      />
      <DropdownModal 
        title="Filter by Category" visible={showCategoryPicker} 
        onClose={() => setShowCategoryPicker(false)} 
        options={categoryOptions} selectedValue={filterCategory} onSelect={setFilterCategory} 
      />
    </View>
  );
}

// --- ANALYTICS & BUDGET SCREEN ---
const AnalyticsScreen = () => {
  const { theme } = useContext(ThemeContext);
  const { stats, budgets } = useContext(DataContext);

  const topCategories = Object.keys(stats.categoryTotals)
    .map(catId => ({ ...CATEGORIES.find(c => c.id === catId), total: stats.categoryTotals[catId] }))
    .filter(c => c.name).sort((a, b) => b.total - a.total);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <Typo variant="h2" style={{ marginBottom: 20 }}>Analytics & Budgets</Typo>
      
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Typo variant="h3" style={{ marginBottom: 4 }}>Wallet Usage</Typo>
          <Typo variant="body" color={theme.textSecondary}>You spend <Typo variant="body" weight="bold" color={theme.primary}>{stats.upiPercentage}%</Typo> of your money using UPI.</Typo>
        </View>
        <Ionicons name="pie-chart" size={48} color={theme.primaryLight} />
      </Card>

      {stats.topMerchant && (
        <Card style={{ backgroundColor: theme.expenseLight, borderWidth: 0 }}>
          <Typo variant="caption" color={theme.expense} style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Top Spender</Typo>
          <Typo variant="body" color={theme.expense}>Your most frequent spending location is <Typo variant="body" weight="bold" color={theme.expense}>{stats.topMerchant}</Typo>.</Typo>
        </Card>
      )}

      <Typo variant="h3" style={{ marginTop: 8, marginBottom: 12 }}>Spending & Budgets</Typo>
      <Card>
        {topCategories.length > 0 ? topCategories.map((cat, index) => {
          const budgetLimit = budgets[cat.id];
          const isOverBudget = budgetLimit && cat.total > budgetLimit;
          const percentage = budgetLimit ? Math.min((cat.total / budgetLimit) * 100, 100) : Math.max(5, (cat.total / stats.totalExpense) * 100);

          return (
            <View key={cat.id} style={{ marginBottom: index === topCategories.length - 1 ? 0 : 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <RenderIcon family={cat.family} name={cat.icon} size={18} color={cat.color} />
                  <Typo variant="body" weight="600" style={{ marginLeft: 8 }}>{cat.name}</Typo>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Typo variant="body" weight="bold" color={isOverBudget ? theme.expense : theme.text}>{formatCurrency(cat.total)}</Typo>
                  {budgetLimit && <Typo variant="caption" style={{ fontSize: 11 }}>of {formatCurrency(budgetLimit)} limit</Typo>}
                </View>
              </View>
              <View style={{ height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ height: '100%', backgroundColor: isOverBudget ? theme.expense : cat.color, width: `${percentage}%` }} />
              </View>
              {isOverBudget && <Typo variant="caption" color={theme.expense} style={{ marginTop: 4, fontSize: 11, fontWeight: 'bold' }}>Budget Exceeded!</Typo>}
            </View>
          );
        }) : (
          <Typo variant="caption" style={{ textAlign: 'center', paddingVertical: 20 }}>Not enough data for analytics.</Typo>
        )}
      </Card>
    </ScrollView>
  );
}

// --- SETTINGS SCREEN (Profile & Edit) ---
const SettingsScreen = ({ user }) => {
  const { theme, updateTheme } = useContext(ThemeContext);
  const { showAlert } = useContext(AlertContext);
  const { userProfile, updateUserProfile } = useContext(DataContext);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const displayName = userProfile?.name || user?.displayName || 'User';
  const displayPhone = userProfile?.phone || 'No phone number';

  const handleEditOpen = () => {
    setEditName(userProfile?.name || user?.displayName || '');
    setEditPhone(userProfile?.phone || '');
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      return showAlert("Missing Details", "Please provide both Name and Mobile Number.", "error");
    }
    await updateUserProfile(editName.trim(), editPhone.trim());
    setIsEditing(false);
    showAlert("Success", "Profile updated successfully.", "success");
  };

  const handleLogout = () => {
    showAlert("Sign Out", "Are you sure you want to log out of your account?", "confirm", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut(auth) }
    ]);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <Typo variant="h2" style={{ marginBottom: 20 }}>Settings</Typo>
      
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.avatarLarge, { backgroundColor: theme.primaryLight }]}>
          <Typo variant="h1" color={theme.primary}>{displayName.charAt(0).toUpperCase()}</Typo>
        </View>
        <View style={styles.flex1}>
          <Typo variant="h3">{displayName}</Typo>
          <Typo variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>{displayPhone}</Typo>
          <Typo variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>{user?.email}</Typo>
          <TouchableOpacity onPress={handleEditOpen} style={{ marginTop: 8 }}>
            <Typo variant="caption" color={theme.primary} weight="bold">Edit Profile</Typo>
          </TouchableOpacity>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="color-palette" size={22} color={theme.textSecondary} style={{ marginRight: 12 }} />
          <Typo variant="h3">Appearance</Typo>
        </View>
        
        <View style={styles.settingRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={theme.isDark ? "moon" : "sunny"} size={20} color={theme.text} style={{ marginRight: 12 }} />
            <Typo variant="body" weight="500">Dark Mode</Typo>
          </View>
          <TouchableOpacity 
            onPress={() => updateTheme(theme.isDark ? 'light' : 'dark', 'purple')}
            style={[styles.toggleSwitch, { backgroundColor: theme.isDark ? theme.primary : theme.border, alignItems: theme.isDark ? 'flex-end' : 'flex-start' }]}
          >
            <View style={styles.toggleKnob} />
          </TouchableOpacity>
        </View>

        <Typo variant="body" weight="500" style={{ marginBottom: 12, marginTop: 8 }}>Theme Accent Color</Typo>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {['purple', 'blue', 'green'].map(color => (
            <TouchableOpacity key={color} onPress={() => updateTheme(theme.mode, color)} style={[styles.colorButton, { backgroundColor: ACCENTS[color].primary, borderColor: theme.accentCode === color ? theme.text : 'transparent' }]} />
          ))}
        </View>
      </Card>

      <TouchableOpacity onPress={handleLogout} style={[styles.signOutButton, { backgroundColor: theme.expenseLight }]}>
        <Ionicons name="log-out" size={20} color={theme.expense} style={{ marginRight: 8 }} />
        <Typo variant="h3" color={theme.expense} weight="bold">Log Out</Typo>
      </TouchableOpacity>

      {/* Edit Profile Modal */}
      <Modal visible={isEditing} animationType="fade" transparent>
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }]} activeOpacity={1}>
          <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 24 }}>
            <Typo variant="h2" style={{ marginBottom: 20 }}>Edit Profile</Typo>
            
            <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Full Name</Typo>
            <TextInput 
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 16 }]}
              value={editName} onChangeText={setEditName}
            />
            
            <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Mobile Number</Typo>
            <TextInput 
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 24 }]}
              keyboardType="phone-pad" value={editPhone} onChangeText={setEditPhone}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setIsEditing(false)} style={[{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.background }]}>
                <Typo variant="h3">Cancel</Typo>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditSave} style={[{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.primary }]}>
                <Typo variant="h3" color="#FFF">Save</Typo>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </ScrollView>
  );
};

// ==========================================
// 7. ADD TRANSACTION MODAL
// ==========================================
const AddTransactionModal = ({ visible, onClose }) => {
  const { theme } = useContext(ThemeContext);
  const { showAlert } = useContext(AlertContext);
  const { addTransaction } = useContext(DataContext);
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('upi');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) { setType('expense'); setAmount(''); setCategory(''); setWallet('upi'); setMerchant(''); setNotes(''); }
  }, [visible]);

  const handleSave = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return showAlert("Input Error", "Please enter a valid amount.", "error");
    if (!category) return showAlert("Input Error", "Please select a category.", "error");
    if (type === 'expense' && !merchant.trim()) return showAlert("Input Error", "Please enter a merchant or place.", "error");
    
    addTransaction({ amount: parseFloat(amount), type, category, wallet, merchant: merchant.trim(), notes: notes.trim() });
    onClose();
    showAlert("Success", "Transaction added successfully.", "success");
  };

  const filteredCategories = CATEGORIES.filter(c => type === 'income' ? c.isIncome || c.id === 'other' : !c.isIncome);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Typo variant="h2">New Transaction</Typo>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              
              <View style={[styles.toggleContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TouchableOpacity onPress={() => setType('expense')} style={[styles.toggleBtn, { backgroundColor: type === 'expense' ? theme.expense : 'transparent' }]}>
                  <Typo variant="body" weight="bold" color={type === 'expense' ? '#FFF' : theme.textSecondary}>Expense</Typo>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setType('income')} style={[styles.toggleBtn, { backgroundColor: type === 'income' ? theme.income : 'transparent' }]}>
                  <Typo variant="body" weight="bold" color={type === 'income' ? '#FFF' : theme.textSecondary}>Income</Typo>
                </TouchableOpacity>
              </View>

              <View style={styles.amountContainer}>
                <Typo variant="caption" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Amount</Typo>
                <View style={styles.amountInputRow}>
                  <Typo variant="h1" color={theme.textSecondary} style={{ marginRight: 8, fontSize: 36 }}>₹</Typo>
                  <TextInput 
                    style={[styles.amountInput, { color: theme.text }]} keyboardType="numeric" placeholder="0" 
                    placeholderTextColor={theme.border} value={amount} onChangeText={setAmount} autoFocus
                  />
                </View>
              </View>

              <Typo variant="h3" style={{ marginBottom: 12 }}>Payment Method</Typo>
              <View style={styles.row}>
                <TouchableOpacity onPress={() => setWallet('upi')} style={[styles.methodBtn, { borderColor: wallet === 'upi' ? theme.primary : theme.border, backgroundColor: wallet === 'upi' ? theme.primaryLight : theme.card, marginRight: 8 }]}>
                  <Ionicons name="qr-code" size={20} color={wallet === 'upi' ? theme.primary : theme.textSecondary} style={{ marginRight: 8 }} />
                  <Typo variant="body" weight={wallet === 'upi' ? 'bold' : 'normal'} color={wallet === 'upi' ? theme.primary : theme.text}>UPI</Typo>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWallet('cash')} style={[styles.methodBtn, { borderColor: wallet === 'cash' ? theme.primary : theme.border, backgroundColor: wallet === 'cash' ? theme.primaryLight : theme.card, marginLeft: 8 }]}>
                  <Ionicons name="wallet" size={20} color={wallet === 'cash' ? theme.primary : theme.textSecondary} style={{ marginRight: 8 }} />
                  <Typo variant="body" weight={wallet === 'cash' ? 'bold' : 'normal'} color={wallet === 'cash' ? theme.primary : theme.text}>Cash</Typo>
                </TouchableOpacity>
              </View>

              <Typo variant="h3" style={{ marginBottom: 12, marginTop: 24 }}>Category</Typo>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {filteredCategories.map(cat => (
                  <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} style={styles.categoryBtn}>
                    <View style={[styles.categoryIconBg, { backgroundColor: category === cat.id ? cat.color : theme.card, borderColor: category === cat.id ? 'transparent' : theme.border }]}>
                      <RenderIcon family={cat.family} name={cat.icon} size={24} color={category === cat.id ? '#FFF' : cat.color} />
                    </View>
                    <Typo variant="caption" style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={2}>{cat.name}</Typo>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {type === 'expense' && (
                <>
                  <Typo variant="h3" style={{ marginBottom: 12 }}>Place / Merchant</Typo>
                  <TextInput 
                    style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder="e.g. Swiggy, Amazon" placeholderTextColor={theme.textSecondary} value={merchant} onChangeText={setMerchant}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24, marginTop: 12 }}>
                    {MERCHANT_SUGGESTIONS.map(m => (
                      <TouchableOpacity key={m} onPress={() => setMerchant(m)} style={[styles.suggestionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Typo variant="caption">{m}</Typo>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Typo variant="h3" style={{ marginBottom: 12 }}>Notes (Optional)</Typo>
              <TextInput 
                style={[styles.textInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, marginBottom: 40 }]}
                placeholder="Add details..." placeholderTextColor={theme.textSecondary} value={notes} onChangeText={setNotes}
              />

              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                <Typo variant="h3" color="#FFF" weight="bold">Save Transaction</Typo>
              </TouchableOpacity>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ==========================================
// 8. ROOT NAVIGATION & LAYOUT
// ==========================================
const MainApp = ({ user }) => {
  const { theme } = useContext(ThemeContext);
  const [currentTab, setCurrentTab] = useState('Home');
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <SafeContainer>
      {currentTab === 'Home' && <HomeScreen user={user} />}
      {currentTab === 'History' && <TransactionsScreen />}
      {currentTab === 'Analytics' && <AnalyticsScreen />}
      {currentTab === 'Settings' && <SettingsScreen user={user} />}

      {/* Floating Action Button */}
      <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity onPress={() => setCurrentTab('Home')} style={styles.navItem}>
          <Ionicons name={currentTab === 'Home' ? "home" : "home-outline"} size={24} color={currentTab === 'Home' ? theme.primary : theme.textSecondary} />
          <Typo variant="caption" style={{ fontSize: 10, marginTop: 4, color: currentTab === 'Home' ? theme.primary : theme.textSecondary, fontWeight: currentTab === 'Home' ? 'bold' : 'normal' }}>Home</Typo>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setCurrentTab('History')} style={[styles.navItem, { paddingRight: 30 }]}>
          <Ionicons name={currentTab === 'History' ? "list" : "list-outline"} size={26} color={currentTab === 'History' ? theme.primary : theme.textSecondary} />
          <Typo variant="caption" style={{ fontSize: 10, marginTop: 2, color: currentTab === 'History' ? theme.primary : theme.textSecondary, fontWeight: currentTab === 'History' ? 'bold' : 'normal' }}>History</Typo>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setCurrentTab('Analytics')} style={[styles.navItem, { paddingLeft: 30 }]}>
          <Ionicons name={currentTab === 'Analytics' ? "pie-chart" : "pie-chart-outline"} size={24} color={currentTab === 'Analytics' ? theme.primary : theme.textSecondary} />
          <Typo variant="caption" style={{ fontSize: 10, marginTop: 4, color: currentTab === 'Analytics' ? theme.primary : theme.textSecondary, fontWeight: currentTab === 'Analytics' ? 'bold' : 'normal' }}>Analytics</Typo>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setCurrentTab('Settings')} style={styles.navItem}>
          <Ionicons name={currentTab === 'Settings' ? "settings" : "settings-outline"} size={24} color={currentTab === 'Settings' ? theme.primary : theme.textSecondary} />
          <Typo variant="caption" style={{ fontSize: 10, marginTop: 4, color: currentTab === 'Settings' ? theme.primary : theme.textSecondary, fontWeight: currentTab === 'Settings' ? 'bold' : 'normal' }}>Settings</Typo>
        </TouchableOpacity>
      </View>

      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeContainer>
  );
};

// ==========================================
// 9. ENTRY POINT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (usr) => {
        if (isMounted) { setUser(usr); setAuthLoading(false); }
      });
      return () => { isMounted = false; unsubscribe(); };
    } else {
      setAuthLoading(false);
    }
  }, []);

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AlertProvider>
        {user ? (
          <DataProvider user={user}>
            <MainApp user={user} />
          </DataProvider>
        ) : (
          <AuthScreen />
        )}
      </AlertProvider>
    </ThemeProvider>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  smallIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  walletCard: { flex: 1, padding: 18, borderRadius: 24, overflow: 'hidden' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  txIconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  txDetails: { flex: 1, paddingRight: 8 },
  txSubDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  walletBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  txAmount: { alignItems: 'flex-end' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  toggleSwitch: { width: 52, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  colorButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: '88%', borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16, borderBottomWidth: 1 },
  toggleContainer: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 28, borderWidth: 1 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  amountContainer: { alignItems: 'center', marginBottom: 36 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  amountInput: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', minWidth: 150 },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 2 },
  categoryBtn: { alignItems: 'center', minWidth: 70, marginRight: 12 },
  categoryIconBg: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  textInput: { padding: 18, borderRadius: 16, borderWidth: 1, fontSize: 16 },
  suggestionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fab: { position: 'absolute', bottom: 35, left: Dimensions.get('window').width / 2 - 32, width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8, zIndex: 10 },
  bottomNav: { flexDirection: 'row', height: 75, borderTopWidth: 1, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 15 : 0 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, justifyContent: 'space-between', gap: 8 }
});
