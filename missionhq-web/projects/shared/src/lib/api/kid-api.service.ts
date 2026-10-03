import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AvatarView, Celebration, CosmeticItem, LateMissions, MeView, MissionCard, PairResponse, RedeemResponse, Reward, RewardCategory, SquadView, SubmitResponse, ThemeCode, UploadTicket } from './models';

@Injectable({ providedIn: 'root' })
export class KidApi {
  private readonly http = inject(HttpClient);

  pair(pairingCode: string) { return firstValueFrom(this.http.post<PairResponse>('/devices/pair', { pairingCode })); }
  me() { return firstValueFrom(this.http.get<MeView>('/me')); }
  missions() { return firstValueFrom(this.http.get<MissionCard[]>('/me/missions')); }
  lateMissions() { return firstValueFrom(this.http.get<LateMissions>('/me/missions/late')); }
  /** date: yesterday's ISO date for a late report; omitted = today. */
  photoTicket(behaviourId: number, date?: string) {
    return firstValueFrom(this.http.post<UploadTicket>(`/me/missions/${behaviourId}/photo-url`, {}, { params: date ? { date } : {} }));
  }
  /** Raw fetch on purpose: the presigned URL must not receive our Authorization header or the signature breaks. */
  async uploadPhoto(ticket: UploadTicket, blob: Blob) {
    const res = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: blob });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return ticket.key;
  }
  /** photoKey null for a mission that needs no photo; date as for photoTicket. */
  submit(behaviourId: number, photoKey: string | null, date?: string) {
    return firstValueFrom(this.http.post<SubmitResponse>(`/me/missions/${behaviourId}/submit`, { photoKey, date: date ?? null }));
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

  /** As another kid paired on this tablet, without switching to them: the shared tablet's "who's reporting?" screen. */
  meAs(token: string) { return firstValueFrom(this.http.get<MeView>('/me', { headers: as(token) })); }
  missionsAs(token: string) { return firstValueFrom(this.http.get<MissionCard[]>('/me/missions', { headers: as(token) })); }
}

/** The device-token interceptor leaves an Authorization header that is already set alone. */
function as(token: string) { return new HttpHeaders({ Authorization: `Device ${token}` }); }
