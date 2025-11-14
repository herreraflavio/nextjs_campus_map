// components/map/events/backendEventTypes.ts

export interface BackendEventDTO {
  id: string;
  _id: string;
  location: string;
  date: string; // "YYYY-MM-DD"
  start_at: string; // "HH:MM"
  end_at: string; // "HH:MM"
  host: string;
  title: string;
  description: string;
  poster_path: string | null;
  poster_url: string | null;
  start_dt: string | null; // ISO datetime
  created_at: string | null; // ISO datetime
}
