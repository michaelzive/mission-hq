import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApprovalQueue, AuthMe, Behaviour, BehaviourInput, CreatedInvite, Household, InvitePreview, ParentInviteView, ParentMember, KidInput, KidSummary, OpenRedemption, RewardAdmin, RewardAdminInput } from './models';

@Injectable({ providedIn: 'root' })
export class ParentApi {
  private readonly http = inject(HttpClient);

  pushPublicKey() { return firstValueFrom(this.http.get<{ publicKey: string }>('/push/public-key')); }
  pushSubscribe(sub: PushSubscriptionJSON) { return firstValueFrom(this.http.post<void>('/push/subscribe', sub)); }
  authMe() { return firstValueFrom(this.http.get<AuthMe>('/auth/me')); }
  parents() { return firstValueFrom(this.http.get<ParentMember[]>('/parents')); }
  renameMe(name: string) { return firstValueFrom(this.http.put<ParentMember>('/parents/me', { name })); }
  removeParent(id: number) { return firstValueFrom(this.http.delete<void>(`/parents/${id}`)); }
  invites() { return firstValueFrom(this.http.get<ParentInviteView[]>('/invites')); }
  createInvite() { return firstValueFrom(this.http.post<CreatedInvite>('/invites', {})); }
  cancelInvite(id: number) { return firstValueFrom(this.http.delete<void>(`/invites/${id}`)); }
  invitePreview(token: string) { return firstValueFrom(this.http.get<InvitePreview>('/invites/preview', { params: { token } })); }
  acceptInvite(token: string, name: string) { return firstValueFrom(this.http.post<AuthMe>('/invites/accept', { token, name })); }
  household() { return firstValueFrom(this.http.get<Household>('/household')); }
  kids() { return firstValueFrom(this.http.get<KidSummary[]>('/kids')); }
  createKid(body: KidInput) { return firstValueFrom(this.http.post<KidSummary>('/kids', body)); }
  updateKid(id: number, body: KidInput) { return firstValueFrom(this.http.put<KidSummary>(`/kids/${id}`, body)); }
  behaviours() { return firstValueFrom(this.http.get<Behaviour[]>('/behaviours')); }
  createBehaviour(body: BehaviourInput) { return firstValueFrom(this.http.post<Behaviour>('/behaviours', body)); }
  updateBehaviour(id: number, body: BehaviourInput) { return firstValueFrom(this.http.put<Behaviour>(`/behaviours/${id}`, body)); }
  rewards() { return firstValueFrom(this.http.get<RewardAdmin[]>('/rewards')); }
  createReward(body: RewardAdminInput) { return firstValueFrom(this.http.post<RewardAdmin>('/rewards', body)); }
  updateReward(id: number, body: RewardAdminInput) { return firstValueFrom(this.http.put<RewardAdmin>(`/rewards/${id}`, body)); }
  redemptions() { return firstValueFrom(this.http.get<OpenRedemption[]>('/redemptions')); }
  fulfilRedemption(id: number) { return firstValueFrom(this.http.post<void>(`/redemptions/${id}/fulfil`, {})); }
  queue() { return firstValueFrom(this.http.get<ApprovalQueue>('/approvals')); }
  approveMission(id: number, bonusPoints: number) { return firstValueFrom(this.http.post<void>(`/approvals/missions/${id}/approve`, { bonusPoints })); }
  sendBack(id: number, note: string) { return firstValueFrom(this.http.post<void>(`/approvals/missions/${id}/send-back`, { note })); }
  approveReward(id: number, price: number, tier: number | null) { return firstValueFrom(this.http.post<unknown>(`/approvals/rewards/${id}/approve`, { price, tier })); }
  declineReward(id: number) { return firstValueFrom(this.http.post<void>(`/approvals/rewards/${id}/decline`, {})); }
  bonus(kidId: number, points: number, reason: string) { return firstValueFrom(this.http.post<void>(`/kids/${kidId}/bonus`, { points, reason })); }
  setRate(pointsPerCurrencyUnit: number) { return firstValueFrom(this.http.put<void>('/household/exchange-rate', { pointsPerCurrencyUnit })); }
  pairingCode(kidId: number) { return firstValueFrom(this.http.post<{ pairingCode: string }>(`/kids/${kidId}/pairing-code`, {})); }
}
