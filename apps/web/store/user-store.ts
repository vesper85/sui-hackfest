import { create, type StateCreator } from "zustand";

export type UserRole = "borrower" | "lender" | "admin" | null;
export type OnboardingStatus = "pending" | "completed" | null;
export type OnboardingData = {
  borrowerType?: "individual" | "business";
  assets?: string[];
  requestedAmountUsd?: number | null;
  tenureMonths?: number | null;
  purpose?: string | null;
} | null;

export type UserState = {
  userId: number | null;
  walletAddress: string | null;
  role: UserRole;
  onboardingStatus: OnboardingStatus;
  onboardingData: OnboardingData;
  setUser: (payload: {
    userId?: number | null;
    walletAddress?: string | null;
    role?: UserRole;
    onboardingStatus?: OnboardingStatus;
    onboardingData?: OnboardingData;
  }) => void;
  clearUser: () => void;
};

const createUserStore: StateCreator<UserState> = (set) => ({
  userId: null,
  walletAddress: null,
  role: null,
  onboardingStatus: null,
  onboardingData: null,
  setUser: (payload) =>
    set((state) => ({
      userId: payload.userId ?? state.userId,
      walletAddress: payload.walletAddress ?? state.walletAddress,
      role: payload.role ?? state.role,
      onboardingStatus: payload.onboardingStatus ?? state.onboardingStatus,
      onboardingData: payload.onboardingData ?? state.onboardingData,
    })),
  clearUser: () =>
    set({
      userId: null,
      walletAddress: null,
      role: null,
      onboardingStatus: null,
      onboardingData: null,
    }),
});

export const useUserStore = create<UserState>(createUserStore);
