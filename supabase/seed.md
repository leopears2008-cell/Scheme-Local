# Seeding the schemes table

`tools/seed_supabase.py` loads `backend/schemes/*.json` into the `schemes` table with status `needs_review`
(the 16 Scheme Sahayak sheets) or `unverified` (everything imported). It never sets `verified`.
Run it with the SERVICE role key, once, from your own machine. Re-running is safe (upsert by scheme_id).
