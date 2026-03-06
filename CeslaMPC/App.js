// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen        from './src/screens/HomeScreen';
import CanteenScreen     from './src/screens/CanteenScreen';
import CanteenVisitor    from './src/screens/CanteenVisitor';
import CoopScreen        from './src/screens/CoopScreen';        // Admin dashboard
import MemberCoopScreen  from './src/screens/MemberCoopScreen';  // Member portal

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
        <Stack.Screen name="Home"                 component={HomeScreen} />
        <Stack.Screen name="CanteenScreen"        component={CanteenScreen} />
        <Stack.Screen name="CanteenVisitorScreen" component={CanteenVisitor} />
        <Stack.Screen name="CoopScreen"           component={CoopScreen} />
        <Stack.Screen name="MemberCoopScreen"     component={MemberCoopScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}