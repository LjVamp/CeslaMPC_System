// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import HomeScreen from "./src/screens/HomeScreen";
import CanteenScreen from "./src/screens/CanteenScreen";
import CanteenVisitor from "./src/screens/CanteenVisitor";
import CoopScreen from "./src/screens/CoopScreen";
import AdminScreen from "./src/screens/AdminScreen";
import ManageCoopScreen from "./src/screens/ManageCoopScreen";
import ManageCanteenScreen from "./src/screens/ManageCanteenScreen";
import ManageMerchandiseScreen from "./src/screens/ManageMerchandiseScreen";
import ManageBillingScreen from "./src/screens/ManageBillingScreen";
import MerchandiseScreen from "./src/screens/MerchandiseScreen";
import { CanteenProvider } from "./src/context/CanteenContext";
import { MerchandiseProvider } from "./src/context/MerchandiseContext";

const Stack = createStackNavigator();

export default function App() {
  return (
    <CanteenProvider>
    <MerchandiseProvider>
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
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CoopScreen" component={CoopScreen} />
        <Stack.Screen name="AdminScreen" component={AdminScreen} />
        <Stack.Screen name="ManageCoopScreen" component={ManageCoopScreen} />
        <Stack.Screen
          name="ManageCanteenScreen"
          component={ManageCanteenScreen}
        />
        <Stack.Screen
          name="ManageMerchandiseScreen"
          component={ManageMerchandiseScreen}
        />
        <Stack.Screen
          name="ManageBillingScreen"
          component={ManageBillingScreen}
        />
        <Stack.Screen name="CanteenScreen" component={CanteenScreen} />
        <Stack.Screen name="CanteenVisitorScreen" component={CanteenVisitor} />
        <Stack.Screen name="MerchandiseScreen" component={MerchandiseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </MerchandiseProvider>
    </CanteenProvider>
  );
}