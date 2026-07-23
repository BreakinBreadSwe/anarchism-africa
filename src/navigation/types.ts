import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  RemedyDetail: { remedyId: string };
  StoryDetail: { storyId: string };
  Paywall: undefined;
};

export type TabParamList = {
  Remedies: undefined;
  Stories: undefined;
  Saved: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
