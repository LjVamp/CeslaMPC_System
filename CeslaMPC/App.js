// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import HomeScreen from "./src/screens/HomeScreen";
import CanteenScreen from "./src/screens/CanteenScreen";
import CanteenVisitor from "./src/screens/CanteenVisitor";
import CanteenMemberScreen from "./src/screens/CanteenMemberScreen";
import CoopScreen from "./src/screens/CoopScreen";
import AdminScreen from "./src/screens/AdminScreen";
import ManageCoopScreen from "./src/screens/ManageCoopScreen";
import ManageGroceryScreen from "./src/screens/ManageGroceryScreen";
import ManageCanteenScreen from "./src/screens/ManageCanteenScreen";
import ManageMerchandiseScreen from "./src/screens/ManageMerchandiseScreen";
import ManageBillingScreen from "./src/screens/ManageBillingScreen";

// ── Merchandise ───────────────────────────────────────────────────────────────
import MerchandisePortalScreen from "./src/screens/MerchandisePortalScreen";
import MerchandiseMemberScreen from "./src/screens/MerchandiseMemberScreen";
import MerchandiseScreen from "./src/screens/MerchandiseScreen";

// ── Grocery ───────────────────────────────────────────────────────────────────
import GroceryPortalScreen from "./src/screens/GroceryPortalScreen";
import GroceryVisitorScreen from "./src/screens/GroceryVisitorScreen";
import GroceryMemberScreen from "./src/screens/GroceryMemberScreen";

import BillingDashboardScreen from "./src/screens/BillingDashboardScreen";

import { CanteenProvider } from "./src/context/CanteenContext";
import { MerchandiseProvider } from "./src/context/MerchandiseContext";
import { BillingProvider } from "./src/context/BillingContext";
import { GroceryProvider } from "./src/context/GroceryContext";

const Stack = createStackNavigator();

export default function App() {
  return (
    <CanteenProvider>
    <MerchandiseProvider>
    <BillingProvider>
    <GroceryProvider>
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
        <Stack.Screen name="Home"                    component={HomeScreen} />
        <Stack.Screen name="CoopScreen"              component={CoopScreen} />
        <Stack.Screen name="AdminScreen"             component={AdminScreen} />
        <Stack.Screen name="ManageCoopScreen"        component={ManageCoopScreen} />
        <Stack.Screen name="ManageCanteenScreen"     component={ManageCanteenScreen} />
        <Stack.Screen name="ManageGroceryScreen"     component={ManageGroceryScreen} />
        <Stack.Screen name="ManageMerchandiseScreen" component={ManageMerchandiseScreen} />
        <Stack.Screen name="ManageBillingScreen"     component={ManageBillingScreen} />
        <Stack.Screen name="CanteenScreen"           component={CanteenScreen} />
        <Stack.Screen name="CanteenVisitorScreen"    component={CanteenVisitor} />
        <Stack.Screen name="CanteenMemberScreen"     component={CanteenMemberScreen} />

        {/*
          ── MERCHANDISE FLOW ──────────────────────────────────────────
          HomeScreen  →  MerchandisePortalScreen
                              ├── "Member"  →  MerchandiseMemberScreen
                              └── "Visitor" →  MerchandiseScreen
          ─────────────────────────────────────────────────────────────
        */}
        <Stack.Screen name="MerchandisePortalScreen"  component={MerchandisePortalScreen} />
        <Stack.Screen name="MerchandiseMemberScreen"  component={MerchandiseMemberScreen} />
        <Stack.Screen name="MerchandiseScreen"        component={MerchandiseScreen} />

        {/*
          ── GROCERY FLOW ───────────────────────────────────────────────
          HomeScreen  →  GroceryPortalScreen
                              ├── "Member"  →  GroceryMemberScreen   (login + ordering)
                              └── "Visitor" →  GroceryVisitorScreen  (walk-in ordering)
          ─────────────────────────────────────────────────────────────
        */}
        <Stack.Screen name="GroceryPortalScreen"  component={GroceryPortalScreen} />
        <Stack.Screen name="GroceryVisitorScreen" component={GroceryVisitorScreen} />
        <Stack.Screen name="GroceryMemberScreen"  component={GroceryMemberScreen} />

        <Stack.Screen name="BillingDashboardScreen"  component={BillingDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </GroceryProvider>
    </BillingProvider>
    </MerchandiseProvider>
    </CanteenProvider>
  );
}