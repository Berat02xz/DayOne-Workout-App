
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, Platform, Dimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import UserDTO from "@/models/DTO/UserDTO";
import { User } from "@/models/User";
import { Meal } from "@/models/Meals";
import database from "@/database/database";
import CalculateBMI from "@/utils/CalculateBMI";
import { useProStatus } from "@/hooks/useProStatus";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { getCaloriePlans } from "@/utils/GetCaloriePlans";
import { LogoutUser } from "@/api/UserDataEndpoint";
import { removeToken } from "@/api/AxiosInstance";
import UnitSwitch from "@/components/ui/UnitSwitch";
import DevMenu from "@/components/Testing/DevMenu";
import FadeTranslate from "@/components/ui/FadeTranslate";
import BottomSheet, { BottomSheetModal, BottomSheetView, BottomSheetTextInput, BottomSheetScrollView } from "@gorhom/bottom-sheet";

const VERSION = "1.0.0";

// --- Design Tokens (Matching Reference) ---
const D = {
  bg: "#000000",
  card: "#121212",
  cardAlt: "#1C1C1E",
  primary: "#AAFB05",
  text: "#FFFFFF",
  sub: "#666666",
  border: "#222222",
  accent: "#AAFB05",
};

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isPro } = useProStatus();
  
  // Bottom Sheet Modal refs
  const weightSheetRef = useRef<BottomSheetModal>(null);
  const heightSheetRef = useRef<BottomSheetModal>(null);
  const ageSheetRef = useRef<BottomSheetModal>(null);
  const fitnessSheetRef = useRef<BottomSheetModal>(null);
  const equipmentSheetRef = useRef<BottomSheetModal>(null);
  const calorieSheetRef = useRef<BottomSheetModal>(null);

  // Modals state
  const [adjustedWeight, setAdjustedWeight] = useState(0);
  
  const [adjustedHeightFeet, setAdjustedHeightFeet] = useState(0);
  const [adjustedHeightInches, setAdjustedHeightInches] = useState(0);
  const [adjustedHeightCm, setAdjustedHeightCm] = useState(0);

  const [adjustedAge, setAdjustedAge] = useState(0);

  const [fitnessLevelModalVisible, setFitnessLevelModalVisible] = useState(false);
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [calorieModalVisible, setCalorieModalVisible] = useState(false);
  const [caloriePlans, setCaloriePlans] = useState<any[]>([]);
  const [greeting, setGreeting] = useState("Hello");
  const [streak, setStreak] = useState(0);
  const [totalMeals, setTotalMeals] = useState(0);

  const fitnessLevels = ["Beginner", "Intermediate", "Advanced", "Gym Enthusiast"];
  const equipmentOptions = [
    { label: "Home Workouts", value: "Home Workouts" },
    { label: "Basic Equipment", value: "Basic Equipment" },
    { label: "Gym Access", value: "Gym Access" },
  ];

  const userLevel = Math.max(1, Math.floor(totalMeals / 2) + streak + 1);

  useEffect(() => {
    loadUserData();
    const h = new Date().getHours();
    if (h < 5) setGreeting("Good Night");
    else if (h < 12) setGreeting("Good Morning");
    else if (h < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!userId) {
            router.replace("/WelcomeScreen");
            return;
          }
          const meals = await Meal.getTodayMeals(database, userId);
          if (active) setTotalMeals(meals.length);

          const today = new Date();
          const currentDay = today.getDay();
          const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          const monday = new Date(today);
          monday.setDate(diff);
          let s = 0;
          for (let i = currentDay; i >= 0; i--) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const ok = await Meal.DaySuccesfulCalorieIntake(database, userId, d);
            if (ok) s++;
            else if (i !== currentDay) break;
          }
          if (active) setStreak(s);
        } catch (e) { console.log(e); }
      })();
      return () => { active = false; };
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = await User.getUserDetails(database);
      if (user) {
        setUserData({
          name: user.name,
          email: user.email,
          weight: user.weight,
          height: user.height,
          age: user.age,
          gender: user.gender,
          bmi: user.bmi,
          fitnessLevel: user.fitnessLevel,
          equipmentAccess: user.equipmentAccess,
          activityLevel: user.activityLevel,
          goal: user.goal,
          caloricIntake: user.caloricIntake,
          role: user.role,
          unit: user.unit,
        });
        
        // Initialize Modal Values
        setAdjustedWeight(user.weight);
        setAdjustedAge(user.age);
        
        if (user.unit === "imperial") {
            const totalInches = parseFloat(user.height);
            setAdjustedHeightFeet(Math.floor(totalInches / 12));
            setAdjustedHeightInches(Math.round(totalInches % 12));
            setAdjustedHeightCm(0); // Clear metric
        } else {
            setAdjustedHeightCm(parseFloat(user.height));
            setAdjustedHeightFeet(0); 
            setAdjustedHeightInches(0);
        }

        // Calculate calorie plans
        refreshCaloriePlans(user);
      } else {
        await removeToken();
        router.replace("/WelcomeScreen");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCaloriePlans = (user: any) => {
        // Prepare userData in the format expected by GetCaloriePlans
        // The attached example uses strings for some fields, ensuring consistent types
        const userDataFormatted = {
            age: Number(user.age),
            sex: String(user.gender),
            height: user.height, // Keep original string/number format, logic inside utils handles it
            weight: Number(user.weight),
            unit: String(user.unit),
            activity_level: String(user.activityLevel || "Sedentary"), // Default fallback
        };

        const plans = getCaloriePlans(userDataFormatted);
        setCaloriePlans(plans);
  };

  const handleLogout = () => {
    LogoutUser();
  };

  // --- Handlers ---

  const handleUpdateUnit = async (newUnit: "metric" | "imperial") => {
    if (newUnit === userData?.unit) return;
    try {
        const user = await User.getUserDetails(database);
        if(!user) return;

        let newWeight = user.weight;
        let newHeight = user.height;

        // Convert values
        if (newUnit === "imperial" && user.unit === "metric") {
            // Metric to Imperial
            newWeight = parseFloat( (user.weight * 2.20462).toFixed(1) );
            newHeight = (parseFloat(user.height) / 2.54).toString(); // cm to inches
        } else if (newUnit === "metric" && user.unit === "imperial") {
            // Imperial to Metric
            newWeight = parseFloat( (user.weight / 2.20462).toFixed(1) );
            newHeight = (parseFloat(user.height) * 2.54).toFixed(0); // inches to cm
        }

        await database.write(async () => {
            await user.update(u => {
                u.unit = newUnit;
                u.weight = newWeight;
                u.height = newHeight;
            });
        });
        
        // Reload locally
        loadUserData();

    } catch (e) {
        Alert.alert("Error", "Failed to update unit preference");
    }
  };

  const handleUpdateWeight = async () => {
    if (!userData) return;
    try {
        const user = await User.getUserDetails(database);
        if (user) {
             const newBMI = CalculateBMI(
                userData.unit,
                adjustedWeight.toString(),
                userData.height
             );
             await database.write(async () => {
                 await user.update(u => { 
                     u.weight = adjustedWeight;
                     u.bmi = newBMI; 
                 });
             });
             weightSheetRef.current?.dismiss();
             loadUserData(); // refresh UI
        }
    } catch(e) { Alert.alert("Error", "Could not update weight"); }
  };

  const handleUpdateHeight = async () => {
     if (!userData) return;
     try {
         let heightToSave = "";
         if (userData.unit === "imperial") {
             heightToSave = ((adjustedHeightFeet * 12) + adjustedHeightInches).toString();
         } else {
             heightToSave = adjustedHeightCm.toString();
         }

         const user = await User.getUserDetails(database);
         if (user) {
             const newBMI = CalculateBMI(
                userData.unit,
                userData.weight.toString(),
                heightToSave
             );
             await database.write(async () => {
                 await user.update(u => {
                     u.height = heightToSave;
                     u.bmi = newBMI;
                 });
             });
             heightSheetRef.current?.dismiss();
             loadUserData();
         }
     } catch(e) { Alert.alert("Error", "Could not update height"); }
  };

  const handleUpdateAge = async () => {
      if (!userData) return;
      try {
          const user = await User.getUserDetails(database);
          if (user) {
              await database.write(async () => {
                  await user.update(u => { u.age = adjustedAge; });
              });
              ageSheetRef.current?.dismiss();
              loadUserData();
          }
      } catch(e) { Alert.alert("Error", "Could not update age"); }
  };

  const handleUpdateFitnessLevel = async (level: string) => {
        try {
            const user = await User.getUserDetails(database);
            if (user) {
                await database.write(async () => { await user.update(u => { u.fitnessLevel = level; }); });
                fitnessSheetRef.current?.dismiss();
                loadUserData();
            }
        } catch(e) { Alert.alert("Error", "Failed to update fitness level"); }
  };

  const handleUpdateEquipment = async (val: string) => {
      try {
            const user = await User.getUserDetails(database);
            if (user) {
                await database.write(async () => { await user.update(u => { u.equipmentAccess = val; }); });
                equipmentSheetRef.current?.dismiss();
                loadUserData();
            }
        } catch(e) { Alert.alert("Error", "Failed to update equipment"); }
  };

  const handleUpdateCaloriePlan = async (plan: any) => {
      try {
          const user = await User.getUserDetails(database);
          if (user) {
              await database.write(async () => {
                  await user.update(u => {
                      u.goal = plan.type;
                      u.caloricIntake = plan.caloriesPerDay;
                  });
              });
              calorieSheetRef.current?.dismiss();
              loadUserData();
          }
      } catch(e) { Alert.alert("Error", "Failed to update calorie plan"); }
  };

  // Formatters
  const formatHeight = () => {
     if(!userData?.height) return "-";
     if(userData.unit === "metric") return `${userData.height} cm`;
     const total = parseFloat(userData.height);
     if (isNaN(total)) return "-";
     return `${Math.floor(total/12)}'${Math.round(total%12)}`;
  };
  const formatWeight = () => userData?.weight ? `${userData.weight} ${userData.unit === "metric" ? "kg" : "lbs"}` : "-";

  if (loading) return <View style={s.center}><Text style={{color:"#fff"}}>Loading...</Text></View>;

  return (
    <View style={s.container}>
      {/* Top Background Image */}
      <Image
        source={require("@/assets/icons/backgrounds/TopBackground.png")}
        style={s.topBgImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", D.bg]}
        style={s.topBgGradient}
      />

      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        
        {/* -- Top Bar -- */}
        <FadeTranslate order={0}>
            <View style={s.topBar}>
                <View style={s.topBarLeft}>
                    <DevMenu />
                    <TouchableOpacity>
                       <Ionicons name="notifications-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <View style={s.topBarRight}>
                    {/* Streak badge */}
                    <TouchableOpacity 
                      style={s.levelBadge}
                      activeOpacity={0.8}
                      onPress={() => router.push("/Analytics")}
                    >
                        <View style={s.levelIconWrap}>
                            <Text style={{ fontSize: 12 }}>🔥</Text>
                        </View>
                        <Text style={s.levelText}>{streak} Day{streak !== 1 ? 's' : ''}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </FadeTranslate>

        {/* -- Avatar & Profile Info -- */}
        <FadeTranslate order={0.1} delay={50}>
            <View style={s.profileHeader}>
                <View style={s.avatarContainer}>
                    {/* Dashed Ring */}
                    <View style={s.dashRing} />
                    <View style={s.avatarCircle}>
                       <Text style={s.avatarInitials}>{userData?.name?.substring(0,2).toUpperCase()}</Text>
                    </View>
                </View>
                <View style={s.nameRow}>
                    <Text style={s.userName}>{userData?.name || "User"}</Text>
                    {isPro && (
                        <View style={s.proTag}>
                            <Ionicons name="star" size={10} color={D.primary} />
                            <Text style={s.proTagText}>PRO</Text>
                        </View>
                    )}
                </View>
                <Text style={s.userHandle}>@{userData?.email?.split("@")[0] || "handle"}</Text>
            </View>

            {/* -- 3 Stats Row (Clickable) -- */}
            <View style={s.statsRow}>
                <TouchableOpacity style={s.statItem} onPress={() => weightSheetRef.current?.present()}>
                    <Ionicons name="scale-outline" size={20} color={D.primary} style={{marginBottom:4}} />
                    <Text style={s.statVal}>{formatWeight()}</Text>
                    <Text style={s.statLabel}>Weight {userData?.unit === "metric" ? "(kg)" : "(lbs)"}</Text>
                </TouchableOpacity>
                <View style={s.vertDiv} />
                <TouchableOpacity style={s.statItem} onPress={() => {
                    // Pre-fill
                    if (userData.unit === "imperial") {
                        const total = parseFloat(userData.height);
                        setAdjustedHeightFeet(Math.floor(total/12));
                        setAdjustedHeightInches(Math.round(total%12));
                    } else {
                        setAdjustedHeightCm(parseFloat(userData.height));
                    }
                    heightSheetRef.current?.present();
                }}>
                    <Ionicons name="resize-outline" size={20} color={D.primary} style={{marginBottom:4}}/>
                    <Text style={s.statVal}>{formatHeight()}</Text>
                    <Text style={s.statLabel}>Height</Text>
                </TouchableOpacity>
                <View style={s.vertDiv} />
                <TouchableOpacity style={s.statItem} onPress={() => {
                    setAdjustedAge(userData.age);
                    ageSheetRef.current?.present();
                }}>
                    <Ionicons name="calendar-outline" size={20} color={D.primary} style={{marginBottom:4}} />
                    <Text style={s.statVal}>{userData?.age} yrs</Text>
                    <Text style={s.statLabel}>Age</Text>
                </TouchableOpacity>
            </View>
        </FadeTranslate>

        {/* -- Settings Grid (Replacing Calendar/Friends) -- */}
        <FadeTranslate order={0.2} delay={150}>
            <Text style={s.sectionTitle}>Fitness Details</Text>
            <View style={s.grid}>
                 <GridItem 
                    icon="barbell" 
                    label="Fitness Level" 
                    value={userData?.fitnessLevel} 
                    onPress={() => fitnessSheetRef.current?.present()}
                 />
                 <GridItem 
                    icon="fitness" 
                    label="Equipment" 
                    value={userData?.equipmentAccess} 
                    onPress={() => equipmentSheetRef.current?.present()}
                />
                 <GridItem 
                    icon="flame" 
                    label="Calories" 
                    value={`${userData?.caloricIntake}`} 
                    onPress={() => {
                        refreshCaloriePlans(userData);
                        calorieSheetRef.current?.present();
                    }} 
                />
                 <GridItem 
                    icon="body" 
                    label="BMI" 
                    value={userData?.bmi ? Number(userData.bmi).toFixed(1) : "-"} 
                />
            </View>
        </FadeTranslate>

        <FadeTranslate order={0.3} delay={250}>
            <Text style={s.sectionTitle}>Account</Text>
            
            {isPro ? (
                <View style={s.proAccountBtn}>
                    <Ionicons name="star" size={20} color={D.primary} />
                    <Text style={s.proAccountText}>Pro Member</Text>
                </View>
            ) : (
                <TouchableOpacity 
                    style={s.upgradeAccountBtn} 
                    activeOpacity={0.8}
                    onPress={() => router.push("/SubscriptionCheck")}
                >
                    <Ionicons name="sparkles" size={20} color={D.primary} />
                    <Text style={s.upgradeAccountText}>Upgrade to Pro</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={s.logoutRow} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#FF453A" />
                <Text style={s.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </FadeTranslate>
      </ScrollView>

       {/* -- Bottom Sheet Modals -- */}
      
      {/* Weight Sheet */}
      <BottomSheetModal
        ref={weightSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Weight</Text>
           <View style={s.inputContainer}>
               <View style={{alignSelf: 'center', marginBottom: 10}}>
                    <UnitSwitch 
                        unit={userData?.unit || "metric"} 
                        onSelect={handleUpdateUnit} 
                        metricLabel="Kg" 
                        imperialLabel="Lbs" 
                    />
               </View>
               <BottomSheetTextInput 
                  style={s.textInput} 
                  keyboardType="numeric" 
                  value={adjustedWeight.toString()} 
                  onChangeText={(t) => setAdjustedWeight(parseFloat(t) || 0)}
               />
               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateWeight}>
                   <Text style={s.saveBtnText}>Save Weight</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Height Sheet */}
      <BottomSheetModal
        ref={heightSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Height</Text>
           <View style={s.inputContainer}>
                <View style={{alignSelf: 'center', marginBottom: 10}}>
                    <UnitSwitch 
                        unit={userData?.unit || "metric"} 
                        onSelect={handleUpdateUnit} 
                        metricLabel="Cm" 
                        imperialLabel="Ft/In" 
                    />
               </View>
               {userData?.unit === "imperial" ? (
                   <View style={s.rowInputs}>
                       <View style={{flex:1}}>
                           <Text style={s.label}>Feet</Text>
                           <BottomSheetTextInput 
                              style={s.textInput} 
                              keyboardType="numeric"
                              value={adjustedHeightFeet.toString()} 
                              onChangeText={(t) => setAdjustedHeightFeet(parseFloat(t) || 0)}
                           />
                       </View>
                       <View style={{flex:1}}>
                           <Text style={s.label}>Inches</Text>
                           <BottomSheetTextInput 
                              style={s.textInput} 
                              keyboardType="numeric"
                              value={adjustedHeightInches.toString()} 
                              onChangeText={(t) => setAdjustedHeightInches(parseFloat(t) || 0)}
                           />
                       </View>
                   </View>
               ) : (
                   <View>
                        <Text style={s.label}>Centimeters</Text>
                        <BottomSheetTextInput 
                            style={s.textInput} 
                            keyboardType="numeric" 
                            value={adjustedHeightCm.toString()} 
                            onChangeText={(t) => setAdjustedHeightCm(parseFloat(t) || 0)}
                        />
                   </View>
               )}

               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateHeight}>
                   <Text style={s.saveBtnText}>Save Height</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Age Sheet */}
      <BottomSheetModal
        ref={ageSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Edit Age</Text>
           <View style={s.inputContainer}>
               <BottomSheetTextInput 
                  style={s.textInput} 
                  keyboardType="numeric" 
                  value={adjustedAge.toString()} 
                  onChangeText={(t) => setAdjustedAge(parseFloat(t) || 0)}
               />
               <TouchableOpacity style={s.saveBtn} onPress={handleUpdateAge}>
                   <Text style={s.saveBtnText}>Save Age</Text>
               </TouchableOpacity>
           </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Fitness Level Sheet */}
      <BottomSheetModal
        ref={fitnessSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Fitness Level</Text>
           {fitnessLevels.map(l => (
               <TouchableOpacity key={l} style={s.modalOpt} onPress={()=>handleUpdateFitnessLevel(l)}>
                   <Text style={s.modalOptText}>{l}</Text>
                   {userData?.fitnessLevel === l && <Ionicons name="checkmark" size={16} color={D.primary} />}
               </TouchableOpacity>
           ))}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Equipment Sheet */}
      <BottomSheetModal
        ref={equipmentSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Equipment</Text>
           {equipmentOptions.map(l => (
               <TouchableOpacity key={l.value} style={s.modalOpt} onPress={()=>handleUpdateEquipment(l.value)}>
                   <Text style={s.modalOptText}>{l.label}</Text>
                   {userData?.equipmentAccess === l.value && <Ionicons name="checkmark" size={16} color={D.primary} />}
               </TouchableOpacity>
           ))}
        </BottomSheetView>
      </BottomSheetModal>

      {/* Calorie Plan Sheet */}
      <BottomSheetModal
        ref={calorieSheetRef}
        enableDynamicSizing
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetScrollView style={[s.sheetScrollContent, { paddingBottom: insets.bottom + 24 }]}>
           <Text style={s.modalTitle}>Select Goal</Text>
           {caloriePlans.length > 0 ? (
               caloriePlans.map((plan, index) => (
                   <TouchableOpacity 
                       key={index} 
                       style={[
                           s.modalOpt, 
                           userData?.goal === plan.type && {
                               borderColor: D.primary, 
                               borderWidth: 1, 
                               backgroundColor: "rgba(170,251,5,0.1)",
                               borderRadius: 12,
                               borderBottomWidth: 1,
                               paddingHorizontal: 12,
                               marginVertical: 4,
                               borderBottomColor: D.primary,
                           }
                       ]} 
                       onPress={() => handleUpdateCaloriePlan(plan)}
                   >
                       <View style={{flex:1}}>
                           <Text style={s.modalOptText}>{plan.type || "Plan"}</Text>
                           <Text style={s.modalSubText}>{plan.caloriesPerDay} kcal/day</Text>
                       </View>
                       
                       {plan.rate ? (
                           <View style={{backgroundColor: D.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 10}}>
                                <Text style={{color: "#000", fontFamily: theme.bold, fontSize: 12}}>{plan.rate}</Text>
                           </View>
                       ) : null}
                       
                       {userData?.goal === plan.type && <View style={{marginLeft: 10}}><Ionicons name="checkmark-circle" size={20} color={D.primary} /></View>}
                   </TouchableOpacity>
               ))
           ) : (
               <Text style={{color: D.sub, textAlign: "center", padding: 20}}>
                   Ensure your height, weight, and age are set correctly to see plans.
               </Text>
           )}
        </BottomSheetScrollView>
      </BottomSheetModal>

    </View>
  );
}

// Subcomponents
const GridItem = ({icon, label, value, onPress}: any) => (
    <TouchableOpacity style={s.gridItem} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
        <View style={s.gridIconCircle}>
            <Ionicons name={icon} size={20} color="#FFF" />
        </View>
        <View style={{gap:4}}>
            <Text style={s.gridLabel}>{label}</Text>
            <Text style={s.gridValue} numberOfLines={1}>{value}</Text>
        </View>
    </TouchableOpacity>
);

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: D.bg },
    topBgImage: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      width: Dimensions.get("window").width,
      height: Dimensions.get("window").height * 1,
      opacity: 0.4,
    },
    topBgGradient: {
      position: "absolute" as const,
      top: Dimensions.get("window").height * 1,
      left: 0,
      right: 0,
      height: Dimensions.get("window").height * 1,
      zIndex: 1,
    },
    scrollContent: { 
        paddingHorizontal: 20, 
        maxWidth: 768,
        width: "100%",
        alignSelf: "center",
    },
    center: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:D.bg},

    // Header / Top Bar
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 8 },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarWrap: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: D.cardAlt, alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#333",
    },
    avatarTextSmall: { fontFamily: theme.bold, color: "#FFF", fontSize: 16 },
    greetingText: { fontFamily: theme.medium, color: D.sub, fontSize: 12 },
    topBarName: { fontFamily: theme.bold, color: "#FFF", fontSize: 16 },
    topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    levelBadge: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "rgba(170,251,5,0.15)", borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 7,
    },
    levelIconWrap: {
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: D.primary, alignItems: "center", justifyContent: "center",
    },
    levelText: { fontSize: 13, fontFamily: theme.bold, color: D.primary },
    streakPill: {
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: "rgba(255,149,0,0.12)", borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 7,
    },
    streakEmoji: { fontSize: 13 },
    streakText: { fontSize: 13, fontFamily: theme.bold, color: "#FF9500" },

    // Avatar Area
    profileHeader: { alignItems: "center", marginBottom: 24 },
    avatarContainer: { width: 100, height: 100, marginBottom: 12, alignItems:"center", justifyContent:"center" },
    dashRing: { 
        position: "absolute", width: 100, height: 100, borderRadius: 50, 
        borderWidth: 2, borderColor: D.primary, borderStyle: "dashed" 
    },
    avatarCircle: { 
        width: 86, height: 86, borderRadius: 43, 
        backgroundColor: "#222", alignItems: "center", justifyContent: "center" 
    },
    avatarInitials: { fontSize: 32, fontFamily: theme.bold, color: "#FFF" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    userName: { fontSize: 24, fontFamily: theme.black, color: D.text },
    userHandle: { fontSize: 13, fontFamily: theme.medium, color: D.sub, marginBottom: 12 },
    proTag: { 
        paddingHorizontal: 6, 
        paddingVertical: 2, 
        borderRadius: 6, 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: D.primary,
        backgroundColor: "rgba(170,251,5,0.15)",
        gap: 2,
    },
    proTagText: { 
        fontSize: 10, 
        fontFamily: theme.bold, 
        letterSpacing: 0.5,
        color: D.primary,
    },

    // Stats Row
    statsRow: { 
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: D.cardAlt, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10, marginBottom: 24 
    },
    statItem: { flex: 1, alignItems: "center" },
    statVal: { fontSize: 16, fontFamily: theme.bold, color: "#FFF", marginBottom: 2 },
    statLabel: { fontSize: 11, fontFamily: theme.medium, color: D.sub },
    vertDiv: { width: 1, height: 30, backgroundColor: "#333" },

    // Pro Card
    proCard: { 
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#111", borderRadius: 20, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: "#222"
    },
    proTitle: { fontSize: 16, fontFamily: theme.bold, color: "#FFF", marginBottom: 4 },
    proSub: { fontSize: 12, color: D.sub, marginBottom: 12, maxWidth: 180 },
    dotsRow: { flexDirection: "row", gap: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#333" },
    dotActive: { backgroundColor: D.primary },

    // Grid
    sectionTitle: { fontSize: 18, fontFamily: theme.bold, color: "#FFF", marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 30 },
    gridItem: { 
        width: "48%", backgroundColor: D.cardAlt, borderRadius: 16, padding: 16, 
        gap: 12
    },
    gridIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2A2A2A", alignItems: "center", justifyContent: "center" },
    gridLabel: { fontSize: 12, color: D.sub, fontFamily: theme.medium },
    gridValue: { fontSize: 14, color: "#FFF", fontFamily: theme.bold },

    proAccountBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(170,251,5,0.15)", padding: 16, borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1, borderColor: D.primary,
    },
    proAccountText: { fontSize: 15, fontFamily: theme.bold, color: D.primary },
    
    upgradeAccountBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
    },
    upgradeAccountText: { fontSize: 15, fontFamily: theme.bold, color: "#fff" },

    logoutRow: { 
        flexDirection: "row", alignItems: "center", gap: 10, 
        backgroundColor: "rgba(255,69,58,0.1)", padding: 16, borderRadius: 16 
    },
    logoutText: { fontSize: 15, fontFamily: theme.bold, color: "#FF453A" },

    // Bottom Sheet
    sheetBg: { backgroundColor: "#1C1C1E", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    sheetHandle: { backgroundColor: "#555", width: 40 },
    sheetContent: { padding: 24 },
    sheetScrollContent: { padding: 24, maxHeight: 500 },
    modalTitle: { fontSize: 18, fontFamily: theme.bold, color: "#FFF", marginBottom: 20 },
    modalOpt: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#333", alignItems:"center" },
    modalOptText: { fontSize: 16, color: "#FFF", fontFamily: theme.medium },
    modalSubText: { fontSize: 12, color: D.sub, fontFamily: theme.regular, marginTop: 2 },
    
    // Inputs
    inputContainer: { gap: 16 },
    rowInputs: { flexDirection: "row", gap: 12 },
    label: { color: D.sub, marginBottom: 6, fontSize: 12 },
    textInput: { 
        backgroundColor: "#222", color: "#FFF", padding: 16, borderRadius: 12, fontSize: 16, fontFamily: theme.bold,
        borderWidth: 1, borderColor: "#333" 
    },
    saveBtn: { backgroundColor: D.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
    saveBtnText: { color: "#000", fontFamily: theme.bold, fontSize: 16 },
});

