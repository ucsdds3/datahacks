// Just the tables and columns the MCP server touches, so the user-scoped client
// type-checks its queries. The whole schema is in supabase/migrations.

type Application = {
  id: string;
  user_id: string | null;
  event_id: string | null;
  applicant_type: string;
  status: string;
  submitted_at: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  [column: string]: unknown;
};

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: Application;
        Insert: Partial<Application> & { applicant_type: string };
        Update: Partial<Application>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; email: string; role: string; first_name: string | null; last_name: string | null; created_at: string | null };
        Insert: { id: string; email: string; first_name?: string | null; last_name?: string | null };
        Update: { email?: string; first_name?: string | null; last_name?: string | null };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          starts_at: string | null;
          ends_at: string | null;
          applications_open: boolean;
          applications_open_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
