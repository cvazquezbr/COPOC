-- Migration to add Gemini API key and model columns to the users table.
-- Please execute this script directly against your PostgreSQL database.

-- Add the column for the Gemini API key.
-- It's TEXT because API keys can be long and vary in length.
ALTER TABLE "public"."users"
ADD COLUMN "gemini_api_key" TEXT;

-- Add the column for the selected Gemini model name.
-- VARCHAR(255) is sufficient for model names like 'models/gemini-pro'.
ALTER TABLE "public"."users"
ADD COLUMN "gemini_model" VARCHAR(255);

-- Optional: Add a comment to the table to document the change.
COMMENT ON COLUMN "public"."users"."gemini_api_key" IS 'Stores the encrypted Gemini API key for the user.';
COMMENT ON COLUMN "public"."users"."gemini_model" IS 'Stores the default Gemini model selected by the user.';