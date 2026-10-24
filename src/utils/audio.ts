/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SoundEngine: All sound effects completely disabled as requested by the user.
 * Operates as a completely silent no-op engine to ensure maximum smoothness,
 * zero Web Audio contexts, zero audio event listeners, and zero background audio latency.
 */
class SoundEngine {
  public getSoundEnabled(): boolean {
    return false;
  }

  public setSoundEnabled(_enabled: boolean): void {}

  public playIPhoneVerificationSound(..._args: any[]): void {}
  public playCashEntrySound(..._args: any[]): void {}
  public playDeleteSound(..._args: any[]): void {}
  public playClearSound(..._args: any[]): void {}
  public playSuccessSound(..._args: any[]): void {}
  public playErrorSound(..._args: any[]): void {}
  public playTrashSound(..._args: any[]): void {}
  public playClickSound(..._args: any[]): void {}
  public playLoginSound(..._args: any[]): void {}
  public playLogoutSound(..._args: any[]): void {}
  public playCardHoverSound(..._args: any[]): void {}
  public playCashInSound(..._args: any[]): void {}
  public playCashOutSound(..._args: any[]): void {}
  public playSimBalanceRechargeSound(..._args: any[]): void {}
  public playCustomerSelectSound(..._args: any[]): void {}
  public playIncomingMessageSound(..._args: any[]): void {}
  public playCashbookSound(..._args: any[]): void {}
  public playPayBillPaidSound(..._args: any[]): void {}
  public playMessageSentSound(..._args: any[]): void {}
  public playPinUnlockSound(..._args: any[]): void {}
  public playPinErrorSound(..._args: any[]): void {}
  public playTagadaSound(..._args: any[]): void {}
  public playDueWarningSound(..._args: any[]): void {}
}

export const soundEngine = new SoundEngine();
