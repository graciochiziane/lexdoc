-- Actualizar email do admin de graciochiziane
-- Executar no Supabase SQL Editor

UPDATE users
SET email = 'graciochiziane@gmail.com'
WHERE id = '660e8400-e29b-41d4-a716-446655440001'::UUID;

-- Verificar
SELECT id, email, full_name, role FROM users WHERE email = 'graciochiziane@gmail.com';
