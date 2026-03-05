// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './src/screens/HomeScreen';
import CanteenScreen from './src/screens/CanteenScreen';
import CanteenVisitor from './src/screens/CanteenVisitor';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: { opacity: current.progress },
          }),
        }}
      >
        <Stack.Screen name="Home"                component={HomeScreen} />
        <Stack.Screen name="CanteenScreen"       component={CanteenScreen} />
        <Stack.Screen name="CanteenVisitorScreen" component={CanteenVisitor} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
