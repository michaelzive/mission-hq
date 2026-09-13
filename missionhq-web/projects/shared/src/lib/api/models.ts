// Mirrors the Spring Boot DTOs. Regenerate from OpenAPI once springdoc is wired in.
export type ThemeCode = 'AIRSOFT' | 'HERO';
export type MissionStatus = 'TODO' | 'PENDING' | 'APPROVED';
export type CelebrationType =
  | 'MISSION_APPROVED' | 'BONUS' | 'STREAK' | 'RANK_UP' | 'REDEEMED' | 'SQUAD_MILESTONE' | 'SIBLING_RANK_UP' | 'HIGH_FIVE';

export interface RankView { name: string; ordinal: number; nextName: string | null; pointsToNext: number | null; }
export interface TermGoal { rewardId: number; name: string; target: number; progress: number; }
export interface MeView {
  id: number; callsign: string; themeCode: ThemeCode; balance: number; lifetimeEarned: number; streakDays: number;
  rank: RankView; termGoal: TermGoal | null; pointsPerCurrencyUnit: number; avatar: AvatarView;
}
export interface MissionCard { behaviourId: number; title: string; points: number; bonus: boolean; requiresPhoto: boolean; status: MissionStatus; }
export interface Celebration { id: number; kidId: number; type: CelebrationType; points: number | null; refId: number | null; payload: string | null; }
export interface PairResponse { deviceToken: string; kidId: number; callsign: string; themeCode: ThemeCode; }
export interface SubmitResponse { completionId: number; status: string; }
export interface UploadTicket { key: string; url: string; method: string; headers: Record<string, string>; }

// ---- parent side ----
export type RewardCategory = 'GEAR' | 'GAME_TIME' | 'OUTING' | 'TREAT' | 'OTHER';
export interface PendingMission { completionId: number; kidId: number; callsign: string; title: string; points: number; photoKey: string | null; photoUrl: string | null; submittedAt: string; }
export interface PendingReward { rewardId: number; kidId: number; callsign: string; name: string; category: RewardCategory; estimatedCost: number | null; suggestedPrice: number; }
export interface ApprovalQueue { missions: PendingMission[]; rewards: PendingReward[]; }
export interface Household { id: number; name: string; pointsPerCurrencyUnit: number; currency: string; seasonName: string; }
export interface KidSummary { id: number; callsign: string; themeCode: ThemeCode; balance: number; lifetimeEarned: number; streakDays: number; rankName: string; }
export interface KidInput { callsign: string; themeCode: ThemeCode; }
export const THEME_CODES: ThemeCode[] = ['AIRSOFT', 'HERO'];
export type BehaviourKind = 'DAILY' | 'WEEKLY' | 'BONUS';
export interface Behaviour { id: number; title: string; points: number; kind: BehaviourKind; requiresPhoto: boolean; bonusDate: string | null; active: boolean; }
export type BehaviourInput = Omit<Behaviour, 'id'>;
export const REWARD_CATEGORIES: RewardCategory[] = ['GEAR', 'GAME_TIME', 'OUTING', 'TREAT', 'OTHER'];
export interface RewardAdmin { id: number; kidId: number; callsign: string; name: string; category: RewardCategory; price: number | null; tier: number | null; status: RewardStatus; suggestedByKid: boolean; termGoal: boolean; repeatable: boolean; }
export interface RewardAdminInput { kidId: number; name: string; category: RewardCategory; price: number; termGoal: boolean; repeatable: boolean; retired: boolean; }
export interface OpenRedemption { id: number; kidId: number; callsign: string; rewardName: string; pricePaid: number; redeemedAt: string; }

// ---- shop ----
export type RewardStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'RETIRED';
export interface Reward {
  id: number; kidId: number; name: string; category: RewardCategory; estimatedCost: number | null;
  price: number | null; tier: number | null; status: RewardStatus; suggestedByKid: boolean; manualPrice: boolean; termGoal: boolean; repeatable: boolean;
}
export interface RedeemResponse { redemptionId: number; pricePaid: number; }

// ---- avatar & cosmetics ----
export type Slot = 'headgear' | 'eyes' | 'body' | 'back' | 'background' | 'title';
export type CosmeticState = 'OWNED' | 'BUYABLE' | 'LOCKED';
export interface AvatarView { colour: number; slots: Partial<Record<Slot, string>>; }
export interface CosmeticItem { id: number; slot: Slot; name: string; assetKey: string; price: number; unlockRankOrdinal: number; state: CosmeticState; equipped: boolean; }

// ---- squad ----
export interface SquadProgress { id: number; name: string; target: number; progress: number; percent: number; }
export interface Sibling { id: number; callsign: string; rankName: string; themeCode: ThemeCode; avatar: AvatarView; contributionPercent: number; }
export interface SquadView { goal: SquadProgress | null; myContribution: number; siblings: Sibling[]; }
