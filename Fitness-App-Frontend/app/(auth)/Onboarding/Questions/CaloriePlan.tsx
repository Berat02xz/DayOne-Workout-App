import ButtonOnboarding from "@/components/ui/Onboarding/AnswerOnboarding";
import QuestionOnboarding from "@/components/ui/Onboarding/QuestionOnboarding";
import SolidBackground from "@/components/ui/SolidBackground";
import { getCaloriePlans, calculateBMR } from "@/utils/GetCaloriePlans";
import calculateCaloriesPerDay from "@/utils/CalculateCaloriesPerDay";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useOnboarding } from "../NavigationService";
import FadeTranslate from "@/components/ui/FadeTranslate";

const CaloriePlan = () => {
  const { goForward, answers, saveSelection } = useOnboarding();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Prepare userData once here (no hooks for now)
  const userData = {
    age: Number(answers.age) || 30,
    sex: String(answers.gender) || "male",
    height: answers.height || "185",
    weight: Number(answers.weight) || 80,
    unit: String(answers.unit) || "metric",
    activity_level: String(answers.activity_level) || "Sedentary",
  };

  // Calculate once and save once on mount
  useEffect(() => {
    const bmr = calculateBMR(userData);
    const caloriesPerDay = calculateCaloriesPerDay(userData);
    saveSelection("bmr", bmr);
    saveSelection("tdee", caloriesPerDay);
  }, []); // empty array: runs once on mount

  const plans = getCaloriePlans(userData);

  return (
    <>
      <SolidBackground />
      <View style={styles.outerContainer}>
        <View style={styles.container}>
          <FadeTranslate order={1}>
          <QuestionOnboarding question="Choose your calorie plan" />
          </FadeTranslate>
          <View style={{ marginTop: 30 }} />

          {plans.map((plan, index) => (
            <ButtonOnboarding
              key={index}
              text={plan.type}
              undertext={`${plan.caloriesPerDay} kcal/day`}
              badgeText={plan.rate}
              order={index+1}
              height={63}
              textSize={16}
              onClick={() => {
                setSelectedPlan(plan.type);
                saveSelection("calories_target", plan.type);
                if (plan.rate === "") {
                  saveSelection("calorie_deficit", "Maintain");
                } else {
                  saveSelection("calorie_deficit", plan.rate);
                }
                saveSelection("caloric_intake", plan.caloriesPerDay);
                goForward();
              }}
              forQuestion="calorie_plan"
              onClickContinue
            />
          ))}
          <FadeTranslate order={8} duration={1000}>
            <View style={{ marginTop: 5 }}>
              <Text style={styles.noteText}>
                Plans that go below your BMR (your body’s basic energy need) are
                removed.
              </Text>
            </View>
          </FadeTranslate>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: "relative",
  },
  noteText: {
    color: "#ffffff",
    opacity: 0.7,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 18,
    width: 330,
  },
  container: {
    flex: 1,
    paddingTop: 30,
    padding: 25,
    zIndex: 1,
    alignItems: "center",
  },
});

export default CaloriePlan;
