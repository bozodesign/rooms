/**
 * Generate PromptPay QR Code payload
 * Based on EMVCo Specification
 */

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatPromptPayId(id: string): string {
  // Remove all non-digit characters
  const cleanId = id.replace(/\D/g, '');

  // For phone numbers (10 digits), add country code
  if (cleanId.length === 10) {
    return '0066' + cleanId.substring(1); // Remove leading 0 and add country code
  }

  // For tax ID (13 digits), use as is
  if (cleanId.length === 13) {
    return cleanId;
  }

  throw new Error('Invalid PromptPay ID. Must be 10-digit phone or 13-digit tax ID');
}

function encodeEMV(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return id + length + value;
}

export function generatePromptPayPayload(phoneOrTaxId: string, amount?: number): string {
  const formattedId = formatPromptPayId(phoneOrTaxId);

  // Build the payload
  let payload = '';

  // Payload Format Indicator
  payload += encodeEMV('00', '01');

  // Point of Initiation Method (Static QR)
  payload += encodeEMV('01', amount ? '12' : '11'); // 12 = dynamic, 11 = static

  // Merchant Account Information
  let merchantInfo = '';
  merchantInfo += encodeEMV('00', 'A000000677010111'); // AID
  merchantInfo += encodeEMV('01', formattedId); // PromptPay ID

  if (amount) {
    merchantInfo += encodeEMV('02', '00'); // Bill Payment
  }

  payload += encodeEMV('29', merchantInfo);

  // Transaction Currency (764 = THB)
  payload += encodeEMV('53', '764');

  // Transaction Amount
  if (amount) {
    payload += encodeEMV('54', amount.toFixed(2));
  }

  // Country Code
  payload += encodeEMV('58', 'TH');

  // Merchant Name
  payload += encodeEMV('59', 'DORMITORY');

  // Merchant City
  payload += encodeEMV('60', 'BANGKOK');

  // CRC Placeholder
  payload += '6304';

  // Calculate and append CRC
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}

export function getPromptPayQRCodeUrl(phoneOrTaxId: string, amount?: number): string {
  const payload = generatePromptPayPayload(phoneOrTaxId, amount);
  // Using Google Chart API for QR code generation
  return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(payload)}&choe=UTF-8`;
}
