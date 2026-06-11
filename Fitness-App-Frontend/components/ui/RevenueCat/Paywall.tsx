import React, { useEffect, useState } from 'react';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import RevenueCatService from '@/api/RevenueCatService';
import { UpdateUserRoleToPro } from '@/api/UserDataEndpoint';
import { getUserIdFromToken } from '@/api/TokenDecoder';
import Toast from 'react-native-toast-message';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseCompleted?: () => void;
  onRestoreCompleted?: () => void;
}

/**
 * RevenueCat Paywall Component
 * Displays subscription offerings using RevenueCat's Paywall UI
 */
export const Paywall: React.FC<PaywallProps> = ({
  visible,
  onClose,
  onPurchaseCompleted,
  onRestoreCompleted,
}) => {
  const [presenting, setPresenting] = useState(false);
  const [hasPresented, setHasPresented] = useState(false);

  useEffect(() => {
    if (visible && !presenting && !hasPresented) {
      presentPaywall();
    }
  }, [visible]);

  const presentPaywall = async () => {
    if (presenting || hasPresented) return; // Prevent multiple presentations
    
    try {
      setPresenting(true);
      setHasPresented(true);
      console.log('🎨 Presenting RevenueCat paywall...');
      
      // First check if offerings are configured
      console.log('🔍 Checking for offerings...');
      const offerings = await RevenueCatService.getOfferings();
      
      if (!offerings || !offerings.availablePackages || offerings.availablePackages.length === 0) {
        // null offerings on web/Expo Go means RevenueCat isn't supported — not a config error
        if (offerings !== null) {
          console.error('❌ No offerings or packages found — configure offerings in RevenueCat Dashboard');
          Toast.show({
            type: 'error',
            text1: 'Setup Required',
            text2: 'Please configure offerings in RevenueCat Dashboard',
            visibilityTime: 5000,
          });
        }
        onClose();
        return;
      }
      
      console.log('✅ Offerings found:', offerings.identifier);
      console.log('📦 Packages available:', offerings.availablePackages.length);
      
      // You can optionally pass options to customize the paywall
      const paywallResult = await RevenueCatUI.presentPaywall({
        // Optional: override with your own offering
        // offering: customOffering,
        
        // Optional: display close button
        displayCloseButton: true,
      });
      
      console.log('🎯 Paywall result:', paywallResult);
      
      // Convert result to string for comparison (RevenueCat returns string values)
      const resultString = paywallResult?.toString() || '';
      
      if (resultString.includes('PURCHASED')) {
        // Purchase successful
        console.log('✅ Purchase completed');
        
        // Wait a moment for RevenueCat to sync
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isPro = await RevenueCatService.isProActive();
        
        if (isPro) {
          // Update user role in database and local storage
          try {
            const userId = await getUserIdFromToken();
            if (userId) {
              console.log('💾 Updating user role to PRO...');
              await UpdateUserRoleToPro(userId);
              console.log('✅ User role updated successfully');
            }
          } catch (updateError) {
            console.error('⚠️ Failed to update user role:', updateError);
            // Don't block the flow if this fails
          }
          
          Toast.show({
            type: 'success',
            text1: 'Welcome to PRO!',
            text2: 'You now have access to all premium features',
          });
          if (onPurchaseCompleted) {
            onPurchaseCompleted();
          } else {
            onClose();
          }
        } else {
          onClose();
        }
      } else if (paywallResult === PAYWALL_RESULT.RESTORED || resultString.includes('RESTORED')) {
        // Restore successful
        console.log('✅ Purchases restored');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isPro = await RevenueCatService.isProActive();
        
        if (isPro) {
          // Update user role in database and local storage
          try {
            const userId = await getUserIdFromToken();
            if (userId) {
              console.log('💾 Updating user role to PRO after restore...');
              await UpdateUserRoleToPro(userId);
              console.log('✅ User role updated successfully');
            }
          } catch (updateError) {
            console.error('⚠️ Failed to update user role:', updateError);
            // Don't block the flow if this fails
          }
          
          Toast.show({
            type: 'success',
            text1: 'Purchases Restored!',
            text2: 'Your PRO subscription has been restored',
          });
          if (onRestoreCompleted) {
            onRestoreCompleted();
          } else if (onPurchaseCompleted) {
            onPurchaseCompleted();
          } else {
            onClose();
          }
        } else {
          Toast.show({
            type: 'info',
            text1: 'No Purchases Found',
            text2: 'No active subscriptions to restore',
          });
          onClose();
        }
      } else if (paywallResult === PAYWALL_RESULT.CANCELLED || resultString.includes('CANCELLED')) {
        console.log('ℹ️ Paywall cancelled by user');
        console.log('🔄 Calling onClose callback...');
        onClose();
        console.log('✅ onClose callback completed');
      } else if (paywallResult === PAYWALL_RESULT.ERROR || resultString.includes('ERROR')) {
        console.error('❌ Paywall error');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Something went wrong. Please try again.',
        });
        onClose();
      } else {
        // Unknown result, close anyway
        console.log('ℹ️ Unknown paywall result:', resultString, ', closing...');
        onClose();
      }
    } catch (error) {
      console.error('❌ Error presenting paywall:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not show paywall. Please try again.',
      });
      onClose();
    } finally {
      setPresenting(false);
    }
  };

  // Don't render anything - RevenueCat handles its own modal
  return null;
};

export default Paywall;

