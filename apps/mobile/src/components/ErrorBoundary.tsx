/**
 * React Native error boundary.
 *
 * Wraps the app's component tree (or any subtree) so an uncaught error in a
 * screen doesn't crash the entire app to a red box / native crash.
 *
 * - Provides a "Try again" reset that re-mounts children.
 * - `accessibilityLiveRegion='assertive'` so VoiceOver / TalkBack announce
 *   the failure to screen-reader users.
 * - Logs to the console (visible via Expo dev tools / device logs); a
 *   third-party tracker is intentionally NOT wired in per the
 *   "no new external services" constraint, but the seam is here.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable, AccessibilityInfo } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
    // Nudge accessibility services to announce the error UI as soon as it
    // mounts. The `accessibilityLiveRegion` on the alert View handles this
    // on Android; iOS VoiceOver gets a manual announcement.
    AccessibilityInfo.announceForAccessibility(`Error: ${error.message || 'something went wrong'}`);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          className="flex-1 bg-base items-center justify-center p-6"
        >
          <View className="w-full max-w-md p-6 rounded-2xl bg-surface border border-error/30">
            <Text className="text-error text-3xl mb-3" accessibilityElementsHidden>
              ⚠️
            </Text>
            <Text className="text-text-primary text-lg font-bold mb-2">Something went wrong</Text>
            <Text className="text-text-secondary text-sm mb-4">
              {this.state.error.message || 'An unexpected error occurred.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={this.reset}
              className="bg-accent px-4 py-3 rounded-xl items-center"
            >
              <Text className="text-base font-bold">Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}
