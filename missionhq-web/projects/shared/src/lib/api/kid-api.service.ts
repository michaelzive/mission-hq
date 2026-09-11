import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AvatarView, Celebration, CosmeticItem, MeView, MissionCard, PairResponse, RedeemResponse, Reward, RewardCategory, SquadView, SubmitResponse, ThemeCode, UploadTicket } from './models';

@Injectable({ providedIn: 'root' })
export class KidApi {
  private readonly http = inject(HttpClient);

  pair(pairingCode: string) { return firstValueFrom(this.http.post<PairResponse>('/devices/pair', { pairingCode })); }
  me() { return firstValueFrom(this.http.get<MeView>('/me')); }
  missions() { return firstValueFrom(this.http.get<MissionCard[]>('/me/missions')); }
  photoTicket(behaviourId: number) { return firstValueFrom(this.http.post<UploadTicket>(`/me/missions/${behaviourId}/photo-url`, {})); }
  /** Raw fetch on purpose: the presigned URL must not receive our Authorization header or the signature breaks. */
  async uploadPhoto(ticket: UploadTicket, blob: Blob) {
    const res = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: blob });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return ticket.key;
  }
  submit(behaviourId: number, photoKey: string) {
    return firstValueFrom(this.http.post<SubmitResponse>(`/me/missions/${behaviourId}/submit`, { photoKey }));
  }
  rewards() { return firstValueFrom(this.http.get<Reward[]>('/me/rewards')); }
  suggestReward(name: string, category: RewardCategory, estimatedCost: number | null) {
    return firstValueFrom(this.http.post<Reward>('/me/rewards/suggest', { name, category, estimatedCost }));
  }
  redeem(rewardId: number) { return firstValueFrom(this.http.post<RedeemResponse>(`/me/rewards/${rewardId}/redeem`, {})); }
  avatar() { return firstValueFrom(this.http.get<AvatarView>('/me/avatar')); }
  setColour(colour: number) { return firstValueFrom(this.http.put<AvatarView>('/me/avatar/colour', { colour })); }
  cosmetics() { return firstValueFrom(this.http.get<CosmeticItem[]>('/me/cosmetics')); }
  buyCosmetic(id: number) { return firstValueFrom(this.http.post<CosmeticItem>(`/me/cosmetics/${id}/buy`, {})); }
  equipCosmetic(id: number) { return firstValueFrom(this.http.post<AvatarView>(`/me/cosmetics/${id}/equip`, {})); }
  setTheme(themeCode: ThemeCode) { return firstValueFrom(this.http.put<MeView>('/me/theme', { themeCode })); }
  pushPublicKey() { return firstValueFrom(this.http.get<{ publicKey: string }>('/push/public-key')); }
  pushSubscribe(sub: PushSubscriptionJSON) { return firstValueFrom(this.http.post<void>('/me/push/subscribe', sub)); }
  squad() { return firstValueFrom(this.http.get<SquadView>('/me/squad')); }
  highFive(kidId: number) { return firstValueFrom(this.http.post<void>(`/me/squad/high-five/${kidId}`, {})); }
  celebrations() { return firstValueFrom(this.http.get<Celebration[]>('/me/celebrations')); }
  ack(id: number) { return firstValueFrom(this.http.post<void>(`/me/celebrations/${id}/ack`, {})); }
}
