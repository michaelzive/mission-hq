import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApprovalQueue, Behaviour, BehaviourInput, Household, KidInput, KidSummary } from './models';

@Injectable({ providedIn: 'root' })
export class ParentApi {
  private readonly http = inject(HttpClient);

  pushPublicKey() { return firstValueFrom(this.http.get<{ publicKey: string }>('/push/public-key')); }
  pushSubscribe(sub: PushSubscriptionJSON) { return firstValueFrom(this.http.post<void>('/push/subscribe', sub)); }
  household() { return firstValueFrom(this.http.get<Household>('/household')); }
  kids() { return firstValueFrom(this.http.get<KidSummary[]>('/kids')); }
  createKid(body: KidInput) { return firstValueFrom(this.http.post<KidSummary>('/kids', body)); }
  updateKid(id: number, body: KidInput) { return firstValueFrom(this.http.put<KidSummary>(`/kids/${id}`, body)); }
  behaviours() { return firstValueFrom(this.http.get<Behaviour[]>('/behaviours')); }
  createBehaviour(body: BehaviourInput) { return firstValueFrom(this.http.post<Behaviour>('/behaviours', body)); }
  updateBehaviour(id: number, body: BehaviourInput) { return firstValueFrom(this.http.put<Behaviour>(`/behaviours/${id}`, body)); }
  queue() { return firstValueFrom(this.http.get<ApprovalQueue>('/approvals')); }
  approveMission(id: number, bonusPoints: number) { return firstValueFrom(this.http.post<void>(`/approvals/missions/${id}/approve`, { bonusPoints })); }
  sendBack(id: number, note: string) { return firstValueFrom(this.http.post<void>(`/approvals/missions/${id}/send-back`, { note })); }
  approveReward(id: number, price: number, tier: number | null) { return firstValueFrom(this.http.post<unknown>(`/approvals/rewards/${id}/approve`, { price, tier })); }
  declineReward(id: number) { return firstValueFrom(this.http.post<void>(`/approvals/rewards/${id}/decline`, {})); }
  bonus(kidId: number, points: number, reason: string) { return firstValueFrom(this.http.post<void>(`/kids/${kidId}/bonus`, { points, reason })); }
  setRate(pointsPerCurrencyUnit: number) { return firstValueFrom(this.http.put<void>('/household/exchange-rate', { pointsPerCurrencyUnit })); }
  pairingCode(kidId: number) { return firstValueFrom(this.http.post<{ pairingCode: string }>(`/kids/${kidId}/pairing-code`, {})); }
}
