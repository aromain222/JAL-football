export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          position: string;
          transfer_year: number;
          current_school: string;
          previous_school: string | null;
          hometown: string | null;
          class_year: string;
          eligibility_remaining: number;
          stars: number | null;
          academic_status: string | null;
          status: string;
          film_url: string | null;
          contact_window: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["players"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
      };
      player_measurements: {
        Row: {
          player_id: string;
          height_in: number | null;
          weight_lbs: number | null;
          forty_time: number | null;
          shuttle_time: number | null;
          vertical_jump: number | null;
          wing_span_in: number | null;
          verified_at: string | null;
        };
        Insert: Database["public"]["Tables"]["player_measurements"]["Row"];
        Update: Partial<Database["public"]["Tables"]["player_measurements"]["Row"]>;
      };
      player_stats: {
        Row: {
          id: string;
          player_id: string;
          season: number;
          games_played: number | null;
          starts: number | null;
          offensive_snaps: number | null;
          defensive_snaps: number | null;
          special_teams_snaps: number | null;
          passing_yards: number | null;
          rushing_yards: number | null;
          receiving_yards: number | null;
          total_touchdowns: number | null;
          tackles: number | null;
          sacks: number | null;
          interceptions: number | null;
          passes_defended: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["player_stats"]["Row"],
          "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["player_stats"]["Insert"]>;
      };
      teams: {
        Row: {
          id: string;
          name: string;
          conference: string;
          logo_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["teams"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          team_id: string;
          full_name: string;
          role: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      team_needs: {
        Row: {
          id: string;
          team_id: string;
          created_by: string;
          title: string;
          position: string;
          priority: string;
          status: string;
          target_count: number;
          class_focus: string | null;
          min_height_in: number | null;
          max_height_in: number | null;
          min_weight_lbs: number | null;
          max_weight_lbs: number | null;
          min_arm_length_in: number | null;
          max_forty_time: number | null;
          min_years_remaining: number | null;
          scheme: string | null;
          priority_traits: string[] | null;
          production_filters: Json | null;
          min_starts: number | null;
          min_production_score: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["team_needs"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["team_needs"]["Insert"]>;
      };
      player_reviews: {
        Row: {
          id: string;
          need_id: string;
          player_id: string;
          reviewer_id: string;
          decision: string;
          fit_score: number;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["player_reviews"]["Row"],
          "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["player_reviews"]["Insert"]>;
      };
      shortlists: {
        Row: {
          id: string;
          need_id: string;
          player_id: string;
          created_by: string;
          stage: string;
          priority_rank: number | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["shortlists"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["shortlists"]["Insert"]>;
      };
      player_tags: {
        Row: {
          id: string;
          player_id: string;
          tag: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["player_tags"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["player_tags"]["Insert"]>;
      };
    };
  };
}
