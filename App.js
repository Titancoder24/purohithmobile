import React, { Component, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Animated, Platform, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { House, CalendarDays, MessagesSquare, CircleUserRound, ChartNoAxesCombined, CalendarClock, BotMessageSquare, BriefcaseBusiness } from "lucide-react-native";
import * as Linking2 from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { registerForPush } from "./src/lib/notifications";
import { colors, font } from "./src/lib/theme";
import { useI18n } from "./src/lib/i18n";
import { isWeb, webMaxWidth } from "./src/lib/webLayout";
import { PreferencesProvider } from "./src/lib/preferences";
import AppTopBar from "./src/components/AppTopBar";
import BrandLogo from "./src/components/BrandLogo";
import DAPWidget from "./src/components/DAPWidget";
import LoadingScreen from "./src/components/LoadingScreen";
import RolePicker from "./src/screens/RolePicker";
import Login from "./src/screens/Login";
import Home from "./src/screens/customer/Home";
import PriestList from "./src/screens/customer/PriestList";
import PriestDetail from "./src/screens/customer/PriestDetail";
import Booking from "./src/screens/customer/Booking";
import RequestPooja from "./src/screens/customer/RequestPooja";
import RequestProposals from "./src/screens/customer/RequestProposals";
import MyBookings from "./src/screens/customer/MyBookings";
import Profile from "./src/screens/customer/Profile";
import PriestDashboard from "./src/screens/priest/Dashboard";
import Marketplace from "./src/screens/priest/Marketplace";
import Availability from "./src/screens/priest/Availability";
import PriestOnboarding from "./src/screens/priest/Onboarding";
import Chat from "./src/screens/customer/Chat";
import TrackPriest from "./src/screens/customer/TrackPriest";
import ShareLocation from "./src/screens/priest/ShareLocation";
import Conversation from "./src/screens/Conversation";
import CallRoom from "./src/screens/CallRoom";
import Inbox from "./src/screens/Inbox";
import Settings from "./src/screens/Settings";
import { startMobileSession, trackMobileEvent } from "./src/lib/supabase";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();
let typographyConfigured = false;

class WidgetBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("DAP widget failed", error?.message || error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.cotton, primary: colors.brandOrange, card: colors.white, text: colors.ink, border: colors.warmBorder },
};

// Deep-link config: purohith://booking/<id>, purohith://priests
const linking = {
  prefixes: [Linking2.createURL("/"), "purohith://", "https://purohithconnect.com"],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: "home",
          Bookings: "bookings",
          Dashboard: "Dashboard",
          Marketplace: "Marketplace",
          Messages: "Messages",
          Chat: "Chat",
          Availability: "Availability",
          Profile: "Profile",
        },
      },
      PriestList: "priests",
      PriestDetail: "priests/:priestId",
      Booking: "book/:priestId",
      RequestPooja: "request-pooja",
      RequestProposals: {
        path: "request-proposals/:requestId?",
        parse: {
          requestId: String,
        },
      },
    },
  },
};

function TabIcon({ focused, Icon }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: focused ? .88 : .96, speed: 30, bounciness: 0, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }, [focused, scale]);
  return <Animated.View style={[styles.tabIcon, { transform: [{ scale }] }]}> 
    <Icon size={24} color={focused ? colors.brandOrangeDark : "#70706C"} strokeWidth={focused ? 2.7 : 2.1} />
    <View style={[styles.tabDot, focused && styles.tabDotActive]} />
  </Animated.View>;
}

function CustomerTabs() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 980;
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
    <AppTopBar />
    <Tab.Navigator sceneContainerStyle={desktop ? styles.sceneDesktop : undefined} screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.ink,
      tabBarInactiveTintColor: colors.muted2,
      tabBarStyle: desktop ? styles.tabBarDesktop : styles.tabBar,
      tabBarItemStyle: desktop ? styles.tabBarItemDesktop : styles.tabBarItem,
      tabBarIconStyle: desktop ? styles.tabBarIconDesktop : styles.tabBarIconSlot,
      tabBarLabelPosition: desktop ? "below-icon" : "below-icon",
      tabBarShowLabel: true,
      tabBarLabelStyle: styles.tabLabel,
    }}>
      <Tab.Screen name="Home" component={Home} options={{ title: t.tabHome, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={House} /> }} />
      <Tab.Screen name="Bookings" component={MyBookings} options={{ title: t.tabBookings, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={CalendarDays} /> }} />
      <Tab.Screen name="Messages" component={Inbox} options={{ title: "Messages", tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={MessagesSquare} /> }} />
      <Tab.Screen name="Chat" component={Chat} options={{ title: "PuroMitra", tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={BotMessageSquare} /> }} />
      <Tab.Screen name="Profile" component={Profile} options={{ title: t.tabProfile, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={CircleUserRound} /> }} />
    </Tab.Navigator>
    </View>
  );
}

function PriestTabs() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 980;
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
    <AppTopBar />
    <Tab.Navigator sceneContainerStyle={desktop ? styles.sceneDesktop : undefined} screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.ink,
      tabBarInactiveTintColor: colors.muted2,
      tabBarStyle: desktop ? styles.tabBarDesktop : styles.tabBar,
      tabBarItemStyle: desktop ? styles.tabBarItemDesktop : styles.tabBarItem,
      tabBarIconStyle: desktop ? styles.tabBarIconDesktop : styles.tabBarIconSlot,
      tabBarShowLabel: true,
      tabBarLabelStyle: styles.tabLabel,
    }}>
      <Tab.Screen name="Dashboard" component={PriestDashboard} options={{ title: t.tabDashboard, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={ChartNoAxesCombined} /> }} />
      <Tab.Screen name="Marketplace" component={Marketplace} options={{ title: "Requests", tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={BriefcaseBusiness} /> }} />
      <Tab.Screen name="Messages" component={Inbox} options={{ title: "Messages", tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={MessagesSquare} /> }} />
      <Tab.Screen name="Availability" component={Availability} options={{ title: t.tabAvailability, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={CalendarClock} /> }} />
      <Tab.Screen name="Profile" component={Profile} options={{ title: t.tabProfile, tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={CircleUserRound} /> }} />
    </Tab.Navigator>
    </View>
  );
}

const styles = {
  tabBar: { backgroundColor: colors.white, borderTopColor: colors.warmBorder, borderTopWidth: 1, height: Platform.OS === "ios" ? 82 : 72, paddingBottom: Platform.OS === "ios" ? 18 : 8, paddingTop: 7, elevation: 0, shadowOpacity: 0 },
  tabBarItem: { alignItems: "center", justifyContent: "center", paddingTop: 0, paddingBottom: 0, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
  sceneDesktop: { paddingTop: 70, backgroundColor: colors.white },
  tabBarDesktop: { position: "absolute", top: 0, left: 0, right: 0, height: 70, backgroundColor: colors.white, borderBottomColor: colors.warmBorder, borderBottomWidth: 1, borderTopWidth: 0, paddingHorizontal: 24, elevation: 0, shadowOpacity: 0 },
  tabBarItemDesktop: { alignItems: "center", justifyContent: "center", paddingVertical: 5, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) },
  tabBarIconDesktop: { width: 42, height: 31, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  tabBarIconSlot: { width: 42, height: 30, alignItems: "center", justifyContent: "center", marginTop: 0, marginBottom: 1 },
  tabIcon: { width: 38, height: 30, alignItems: "center", justifyContent: "center", gap: 2 },
  tabDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "transparent" },
  tabDotActive: { backgroundColor: colors.brandOrange },
  tabLabel: { fontSize: 10, lineHeight: 12, fontWeight: "600", letterSpacing: 0 },
  splashOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 999, elevation: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, paddingHorizontal: 26 },
  splashCard: { width: "100%", maxWidth: 360, alignItems: "center", justifyContent: "center" },
  splashTitle: { marginTop: 10, color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center", letterSpacing: 0 },
  splashSub: { marginTop: 6, color: colors.muted2, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  splashLine: { width: 164, height: 4, overflow: "hidden", borderRadius: 8, marginTop: 22, backgroundColor: "#F0EAE3" },
  splashLineFill: { flex: 1, borderRadius: 8, backgroundColor: colors.brandOrange },
};

function Router() {
  const { ready, user, role } = useAuth();
  const routeNameRef = useRef();

  // Register for push notifications once we have an authenticated user.
  useEffect(() => {
      if (user) registerForPush().catch((e) => console.warn("push init failed", e?.message));
  }, [user]);

  useEffect(() => {
    startMobileSession().catch((e) => console.warn("analytics session failed", e?.message));
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      fallback={<LoadingScreen />}
      onReady={() => {
        routeNameRef.current = navigationRef.getCurrentRoute()?.name;
        trackMobileEvent("screen_view", { route: routeNameRef.current, role: user?.role || role || "guest" }).catch(() => {});
      }}
      onStateChange={() => {
        const previous = routeNameRef.current;
        const current = navigationRef.getCurrentRoute()?.name;
        if (current && current !== previous) {
          routeNameRef.current = current;
          trackMobileEvent("screen_view", { route: current, previous_route: previous || null, role: user?.role || role || "guest" }).catch(() => {});
        }
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cotton }, headerShadowVisible: false, headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.ink, headerTitleStyle: { fontSize: 16, fontWeight: "700" }, headerBackTitleVisible: false }}>
        {!user && !role && (
          <RootStack.Screen name="RolePicker" component={RolePicker} />
        )}
        {!user && role && (
          <RootStack.Screen name="Login" component={Login} />
        )}
        {user && user.role === "customer" && (
          <>
            <RootStack.Screen name="Tabs" component={CustomerTabs} />
            <RootStack.Screen name="PriestList" component={PriestList} options={{ headerShown: true, title: "Priests" }} />
            <RootStack.Screen name="PriestDetail" component={PriestDetail} options={{ headerShown: true, title: "" }} />
            <RootStack.Screen name="Booking" component={Booking} options={{ headerShown: true, title: "Book" }} />
            <RootStack.Screen name="RequestPooja" component={RequestPooja} options={{ headerShown: true, title: "Request proposals" }} />
            <RootStack.Screen name="RequestProposals" component={RequestProposals} options={{ headerShown: true, title: "Compare proposals" }} />
            <RootStack.Screen name="TrackPriest" component={TrackPriest} options={{ headerShown: true, title: "Live arrival" }} />
            <RootStack.Screen name="Conversation" component={Conversation} options={{ headerShown: false }} />
            <RootStack.Screen name="CallRoom" component={CallRoom} options={{ headerShown: false }} />
            <RootStack.Screen name="Settings" component={Settings} options={{ headerShown: true, title: "Settings" }} />
          </>
        )}
        {user && user.role === "priest" && user.onboardingRequired && (
          <RootStack.Screen name="PriestOnboarding" component={PriestOnboarding} />
        )}
        {user && user.role === "priest" && !user.onboardingRequired && (
          <>
            <RootStack.Screen name="Tabs" component={PriestTabs} />
            <RootStack.Screen name="PriestOnboarding" component={PriestOnboarding} options={{ headerShown: true, title: "Profile" }} />
            <RootStack.Screen name="ShareLocation" component={ShareLocation} options={{ headerShown: true, title: "Share location" }} />
            <RootStack.Screen name="Conversation" component={Conversation} options={{ headerShown: false }} />
            <RootStack.Screen name="CallRoom" component={CallRoom} options={{ headerShown: false }} />
            <RootStack.Screen name="Settings" component={Settings} options={{ headerShown: true, title: "Settings" }} />
          </>
        )}
      </RootStack.Navigator>
      <WidgetBoundary>
        <DAPWidget navigationRef={navigationRef} />
      </WidgetBoundary>
    </NavigationContainer>
  );
}

function LoginSplash({ role, onDone }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(.92)).current;
  const lift = useRef(new Animated.Value(14)).current;
  const lineScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 12, bounciness: 7, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, speed: 14, bounciness: 0, useNativeDriver: true }),
        Animated.timing(lineScale, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
      Animated.delay(520),
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDone?.();
    });
  }, [lift, lineScale, onDone, opacity, scale]);

  return (
    <Animated.View pointerEvents="auto" style={[styles.splashOverlay, { opacity }]}>
      <Animated.View style={[styles.splashCard, { transform: [{ translateY: lift }, { scale }] }]}>
        <BrandLogo width={260} height={118} showText={false} />
        <Text style={styles.splashTitle}>Welcome to Purohith Connect</Text>
        <Text style={styles.splashSub}>{role === "priest" ? "Opening your priest workspace" : "Preparing your pooja booking app"}</Text>
        <View style={styles.splashLine}>
          <Animated.View style={[styles.splashLineFill, { transform: [{ scaleX: lineScale }] }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function AuthAppFrame() {
  const { user, role } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const hadUser = useRef(Boolean(user));

  useEffect(() => {
    const hasUser = Boolean(user);
    if (hasUser && !hadUser.current) {
      setShowSplash(true);
    }
    hadUser.current = hasUser;
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flex: 1, width: "100%", maxWidth: isWeb ? webMaxWidth : undefined, alignSelf: "center", backgroundColor: colors.white, borderLeftWidth: isWeb ? 1 : 0, borderRightWidth: isWeb ? 1 : 0, borderColor: colors.warmBorder }}>
        <StatusBar style="dark" />
        <Router />
        {showSplash ? <LoginSplash role={user?.role || role} onDone={() => setShowSplash(false)} /> : null}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  if (!fontsLoaded) return <LoadingScreen />;
  if (!typographyConfigured) {
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [Text.defaultProps.style, { fontFamily: font.regular }];
    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [TextInput.defaultProps.style, { fontFamily: font.regular }];
    typographyConfigured = true;
  }

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
      <AuthProvider>
        <AuthAppFrame />
      </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
