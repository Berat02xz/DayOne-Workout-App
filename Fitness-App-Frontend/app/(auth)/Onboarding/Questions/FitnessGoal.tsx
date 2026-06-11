import ButtonOnboarding from "@/components/ui/Onboarding/AnswerOnboarding";
import ButtonFit from "@/components/ui/ButtonFit";
import QuestionOnboarding from "@/components/ui/Onboarding/QuestionOnboarding";
import SolidBackground from "@/components/ui/SolidBackground";
import { theme } from "@/constants/theme";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useOnboarding } from "../NavigationService";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const FitnessGoalScreen = () => {
  const { goForward, saveSelection } = useOnboarding();
  const insets = useSafeAreaInsets();

  type FitnessGoal = string;
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoal | null>(null);

  const handleSelectGoal = (goal: FitnessGoal, question: string): void => {
    setSelectedGoal(goal);
    saveSelection(question, goal);
  };

  return (
    <>
      <SolidBackground />
      <View style={styles.outerContainer}>
        <View style={styles.container}>
          <FadeTranslate order={2}>
          <QuestionOnboarding question="What is your fitness goal?" />
          </FadeTranslate>
          <View style={{ marginTop: 30 }} />

          <ButtonOnboarding
            text="Lose Fat"
            forQuestion="fitness_goal"
            order={3}
            onClickContinue={false}
            onClick={() => handleSelectGoal("Lose Fat", "fitness_goal")}
            isMultipleAnswers={true}
          />
          <ButtonOnboarding
            text="Gain Muscle"
            forQuestion="fitness_goal"
            order={4}
            onClickContinue={false}
            onClick={() => handleSelectGoal("Gain Muscle", "fitness_goal")}
            isMultipleAnswers={true}
          />
          <ButtonOnboarding
            text="Build Strength"
            forQuestion="fitness_goal"
            order={5}
            onClickContinue={false}
            onClick={() => handleSelectGoal("Build Strength", "fitness_goal")}
            isMultipleAnswers={true}
          />
          <ButtonOnboarding
            text="Holistic Wellbeing"
            forQuestion="fitness_goal"
            order={6}
            onClickContinue={false}
            onClick={() =>
              handleSelectGoal("Holistic Wellbeing", "fitness_goal")
            }
            isMultipleAnswers={true}
          />
        </View>
        {selectedGoal && (
          <View style={[styles.bottom, { marginBottom: insets.bottom + 24 }]}>
            <ButtonFit
              title="Continue"
              backgroundColor={theme.primary}
              onPress={goForward}
            />
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: "relative",
  },
  bottom: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    paddingTop: 30,
    padding: 25,
    zIndex: 1,
    alignItems: "center",
  },
});

export default FitnessGoalScreen;
