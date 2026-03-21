const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? 'WalletWise (Dev)' : 'WalletWise',
    slug: 'walletwise',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1A56DB',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: IS_DEV ? 'com.walletwise.app.dev' : 'com.walletwise.app',
    },
    androidStatusBar: {
      barStyle: 'dark-content',
      backgroundColor: '#FFFFFF',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      package: IS_DEV ? 'com.walletwise.app.dev' : 'com.walletwise.app',
      googleServicesFile: './google-services.json',
    },
    web: {
      bundler: 'metro',
    },
    scheme: 'walletwise',
    updates: {
      url: 'https://u.expo.dev/02124cb6-bd4d-42e7-b8ba-b88f7f635f94',
      enabled: !IS_DEV,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    plugins: [
      ...(IS_DEV ? ['expo-dev-client'] : []),
      'expo-router',
      'expo-secure-store',
      'expo-web-browser',
      ['expo-notifications', { color: '#1A56DB' }],
      [
        'expo-font',
        {
          fonts: [
            'node_modules/@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf',
            'node_modules/@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf',
            'node_modules/@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf',
            'node_modules/@expo-google-fonts/ibm-plex-sans/700Bold/IBMPlexSans_700Bold.ttf',
            'node_modules/@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf',
            'node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf',
          ],
        },
      ],
      'expo-sqlite',
    ],
    extra: {
      router: {},
      eas: {
        projectId: '02124cb6-bd4d-42e7-b8ba-b88f7f635f94',
      },
    },
  },
};
