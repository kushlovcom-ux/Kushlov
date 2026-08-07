import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  Onboarding: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Matches: undefined;
  Messages: undefined;
  Live: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  PublicProfile: { userId: string };
  Chat: { conversationId: string; title?: string; peerId?: string };
  Matches: undefined;
  Notifications: undefined;
  Settings: undefined;
  EditProfile: undefined;
  Privacy: undefined;
  BlockedUsers: undefined;
  NotificationSettings: undefined;
  CallHistory: undefined;
  GroupCall: undefined;
  History: undefined;
  Transactions: undefined;
  LiveRoom: { liveId: string; coliveToken?: string; livekitUrl?: string };
  LiveList: undefined;
  GoLive: undefined;
  BecomeHost: undefined;
  Contact: undefined;
  LocationSetup: undefined;
  Profile: undefined;
  Wallet: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
