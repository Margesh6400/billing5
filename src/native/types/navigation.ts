import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Clients: undefined;
  Stock: undefined;
  ChallanManagement: undefined;
  BillManagement: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Issue: undefined;
  Return: undefined;
  Ledger: undefined;
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

export type CompositeNavigationProp = CompositeNavigationProp<
  MainTabNavigationProp,
  RootStackNavigationProp
>;

export type DashboardScreenRouteProp = RouteProp<MainTabParamList, 'Dashboard'>;
export type IssueScreenRouteProp = RouteProp<MainTabParamList, 'Issue'>;
export type ReturnScreenRouteProp = RouteProp<MainTabParamList, 'Return'>;
export type LedgerScreenRouteProp = RouteProp<MainTabParamList, 'Ledger'>;