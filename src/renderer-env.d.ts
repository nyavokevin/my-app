import type { GymMemberApi } from './shared/gym-members';

declare global {
  interface Window {
    gymMembers: GymMemberApi;
  }
}

export {};