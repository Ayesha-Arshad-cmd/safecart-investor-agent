import { api } from './api';
import type { Audience } from '../types';

/**
 * "Open in Google Sheets": the server asks your Gmail helper script to create a Google Sheet in your Drive,
 * then the sheet opens in a new tab (from there: File → Download if you want a file).
 * If the helper isn't set up / updated yet, falls back to downloading a CSV that Google Sheets can import.
 */
export async function openInGoogleSheets(audience: Audience, fallbackCsv: () => void, toast: (msg: string, error?: boolean) => void) {
  // open the tab right away (browsers block pop-ups opened after waiting)
  const tab = window.open('', '_blank');
  if (tab) tab.document.write('<p style="font-family:sans-serif;padding:24px">Creating your Google Sheet…</p>');
  try {
    const r = await api.sheet(audience);
    if (tab) tab.location.href = r.url;
    else window.open(r.url, '_blank');
    toast(`Google Sheet created with ${r.rows} rows — it's also saved in your Google Drive.`);
  } catch (e: any) {
    tab?.close();
    fallbackCsv();
    toast(`${e?.message || 'Could not create the Google Sheet'} Downloaded a CSV instead (open it with Google Sheets → File → Import).`, true);
  }
}
