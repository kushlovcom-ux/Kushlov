export const Routes = {
  // Auth stack
  Onboarding: 'Onboarding',
  Welcome: 'Welcome',
  Login: 'Login',
  Register: 'Register',
  ForgotPassword: 'ForgotPassword',

  // Tabs
  Home: 'Home',
  Discover: 'Discover',
  Matches: 'Matches',
  Messages: 'Messages',
  Profile: 'Profile',

  // App stack (modals / pushes)
  PublicProfile: 'PublicProfile',
  EditProfile: 'EditProfile',
  Chat: 'Chat',
  LiveList: 'LiveList',
  LiveRoom: 'LiveRoom',
  Wallet: 'Wallet',
  Notifications: 'Notifications',
  Settings: 'Settings',
  BlockedUsers: 'BlockedUsers',
  BecomeHost: 'BecomeHost',
  Contact: 'Contact',
  History: 'History',
  LocationSetup: 'LocationSetup',
} as const;

export type RouteName = (typeof Routes)[keyof typeof Routes];
