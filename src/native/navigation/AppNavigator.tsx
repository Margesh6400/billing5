import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuth } from '../../hooks/useAuth';
import { AuthScreen } from '../screens/AuthScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { IssueRentalScreen } from '../screens/IssueRentalScreen';
import { ReturnRentalScreen } from '../screens/ReturnRentalScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { StockScreen } from '../screens/StockScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { ChallanManagementScreen } from '../screens/ChallanManagementScreen';
import { BillManagementScreen } from '../screens/BillManagementScreen';
import { LoadingScreen } from '../components/LoadingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  const { user } = useAuth();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'home';
              break;
            case 'Issue':
              iconName = 'add-circle-outline';
              break;
            case 'Return':
              iconName = 'keyboard-return';
              break;
            case 'Ledger':
              iconName = 'book';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'હોમ' }}
      />
      {user?.isAdmin && (
        <>
          <Tab.Screen 
            name="Issue" 
            component={IssueRentalScreen}
            options={{ title: 'ઉધાર' }}
          />
          <Tab.Screen 
            name="Return" 
            component={ReturnRentalScreen}
            options={{ title: 'જમા' }}
          />
        </>
      )}
      <Tab.Screen 
        name="Ledger" 
        component={LedgerScreen}
        options={{ title: 'ખાતાવહી' }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="Clients" 
              component={ClientsScreen}
              options={{ 
                headerShown: true,
                title: 'ગ્રાહકો',
                headerStyle: { backgroundColor: '#2563eb' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' }
              }}
            />
            <Stack.Screen 
              name="Stock" 
              component={StockScreen}
              options={{ 
                headerShown: true,
                title: 'સ્ટોક',
                headerStyle: { backgroundColor: '#2563eb' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' }
              }}
            />
            <Stack.Screen 
              name="ChallanManagement" 
              component={ChallanManagementScreen}
              options={{ 
                headerShown: true,
                title: 'ચલણ બૂક',
                headerStyle: { backgroundColor: '#2563eb' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' }
              }}
            />
            <Stack.Screen 
              name="BillManagement" 
              component={BillManagementScreen}
              options={{ 
                headerShown: true,
                title: 'બિલ વ્યવસ્થાપન',
                headerStyle: { backgroundColor: '#2563eb' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' }
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}