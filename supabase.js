import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hrubbvyileogvybsxmze.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWJidnlpbGVvZ3Z5YnN4bXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDczNzQsImV4cCI6MjA3ODkyMzM3NH0.BKCMLgTYUosBc2Kco3bVKIu1A3oSlOhqjvkwTc9Tm-A'; 

export const supabase = createClient(supabaseUrl, supabaseKey);