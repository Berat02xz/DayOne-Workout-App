import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import Paywall from '@/components/ui/RevenueCat/Paywall';
import { useProStatus } from '@/hooks/useProStatus';
import SolidBackground from '@/components/ui/SolidBackground';

/**
 * Subscription Check Screen
 * Checks if user has PRO subscription after login/registration
 * Shows paywall if not subscribed, otherwise continues to app
 */
export default function SubscriptionCheck() {
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { isPro, loading, refresh } = useProStatus();

  // Function to navigate and reset history
  const navigateToApp = () => {
    router.replace('/workout');
  };

  useEffect(() => {
    // RevenueCat is unavailable on web — skip paywall and go straight to the app
    if (Platform.OS === 'web') {
      navigateToApp();
      return;
    }

    if (!loading && !hasChecked && !isNavigating) {
      setHasChecked(true);

      if (isPro) {
        // User has PRO, continue to app
        console.log('✅ User has PRO subscription, navigating to workout...');
        setIsNavigating(true);
        setTimeout(() => {
          navigateToApp();
        }, 100);
      } else {
        // User doesn't have PRO, show paywall
        console.log('🔒 User needs subscription, showing paywall...');
        setShowPaywall(true);
      }
    }
  }, [loading, hasChecked, isPro, isNavigating]);

  const handlePaywallClose = () => {
    // When user closes paywall (X button), continue to app
    console.log('🔄 handlePaywallClose called - navigating to workout...');
    if (!isNavigating) {
      setIsNavigating(true);
      setShowPaywall(false);
      navigateToApp();
      console.log('✅ Navigation command sent');
    }
  };

  const handlePurchaseCompleted = async () => {
    // When user subscribes, refresh PRO status and navigate
    console.log('✅ User subscribed, refreshing status...');
    if (!isNavigating) {
      setIsNavigating(true);
      setShowPaywall(false);
      
      // Refresh PRO status to ensure it's updated
      await refresh();
      
      // Small delay to ensure navigation doesn't conflict
      setTimeout(() => {
        navigateToApp();
      }, 500);
    }
  };

  // Show loading state while checking subscription
  if (loading || !hasChecked) {
    return (
      <>
        <SolidBackground style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Checking subscription...</Text>
        </View>
      </>
    );
  }

  // Show paywall if needed
  return (
    <>
      <SolidBackground style={StyleSheet.absoluteFill} />
      <View style={styles.container}>
        <Paywall
          visible={showPaywall}
          onClose={handlePaywallClose}
          onPurchaseCompleted={handlePurchaseCompleted}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: theme.fontSize.md,
    fontFamily: theme.medium,
    color: theme.textColor,
  },
});
