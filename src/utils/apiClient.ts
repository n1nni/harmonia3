const API_BASE = 'http://127.0.0.1:3000';

export interface ApiNote {
  rest: boolean;
  pitch?: { step: string; alter: number | null; octave: number };
  duration: number;
  type: string;
  voice: number;
  stem: string | null;
  dot: boolean;
  chord: boolean;
  accidental: string | null;
  beam?: { number: number; value: string };
  lyric?: { syllabic: string | null; text: string | null };
  tied?: string[];
  slur?: { number: number; type: string }[];
}

export interface ApiAttributes {
  divisions: number;
  key?: { fifths: number; mode: string | null };
  time?: { beats: string | null; beat_type: string | null };
  clef?: { sign: string; line: number };
}

export interface ApiMeasure {
  number: number;
  barline: string | null;
  attributes?: ApiAttributes;
  notes: ApiNote[];
}

export interface ApiPart {
  id: string;
  instrument: string;
  measures: ApiMeasure[];
}

export interface ApiResponse {
  title: string | null;
  credits: string[];
  parts: ApiPart[];
}

/** Convert a File to a base64 string (without the data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:image/...;base64," prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Send an image to the OMR API and get digitized score back. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function digitizeImage(file: File): Promise<any> {
  const base64 = await fileToBase64(file);

  const res = await fetch(`${API_BASE}/api/omr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}
