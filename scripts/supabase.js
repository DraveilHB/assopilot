/* ==========================================================================
   SUPABASE CLIENT INITIALIZATION - Assopilot V3
   ========================================================================== */

const SUPABASE_URL = "https://rboftnretbhasthvjdns.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJib2Z0bnJldGJoYXN0aHZqZG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzEzNDMsImV4cCI6MjA5ODA0NzM0M30.RwK0dGMM5e9_ExKfNW4D5Z9bHNrQ1ucvPyTqEzh5v58";

// Initialize the Supabase client
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Global State
window.appState = {
  MOI: "",
  MON_ID: null,
  MON_IDENTIFIANT: "",
  roleActuel: "benevole",
  currentMember: null,
  comptesDemo: [] // Cache for members loaded from Supabase
};
